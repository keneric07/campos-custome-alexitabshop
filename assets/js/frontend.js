(function () {
  'use strict';

  function ready(callback) {
    if (document.readyState !== 'loading') {
      callback();
      return;
    }
    document.addEventListener('DOMContentLoaded', callback);
  }

  ready(function () {
    var box = document.getElementById('alexita-personalizer');
    if (!box) return;

    var form = box.closest('form.cart');
    var wrapper = document.getElementById('alexita-players-wrapper');
    var qtyInput = form ? form.querySelector('input.qty') : null;
    var maxFileSize = parseInt(box.getAttribute('data-max-file-size'), 10) || 2621440;
    var config = window.AlexitaPersonalizer || {};
    var labels = config.labels || {};
    var countries = config.countries || [];
    var countryOptionsHtml = buildCountryOptionsHtml(countries);

    if (form) {
      form.setAttribute('method', 'post');
      layoutCartForm(form, box);
      qtyInput = form.querySelector('input.qty');
      bindCartFormSubmit(form);
      bindWooCommerceAddToCart(form);
    }

    function text(key, fallback) {
      return labels[key] || fallback;
    }

    function escapeAttr(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
    }

    function buildCountryOptionsHtml(list) {
      if (!list.length) {
        return '';
      }

      return list.map(function (country) {
        return (
          '<li role="presentation">' +
            '<button type="button" class="alexita-country__option" role="option" ' +
              'data-code="' + escapeAttr(country.code) + '" ' +
              'data-flag="' + escapeAttr(country.flag) + '" ' +
              'data-name="' + escapeAttr(country.name) + '">' +
              '<span class="alexita-country__flag" aria-hidden="true">' + country.flag + '</span>' +
              '<span class="alexita-country__name">' + country.name + '</span>' +
            '</button>' +
          '</li>'
        );
      }).join('');
    }

    function countryFieldHtml(index) {
      return (
        '<div class="alexita-field alexita-field--country">' +
          '<label>' + text('country', 'País') + '</label>' +
          '<div class="alexita-country">' +
            '<input type="hidden" class="alexita-country__value" name="alexita_players[' + index + '][country]" value="" required>' +
            '<button type="button" class="alexita-country__toggle" aria-haspopup="listbox" aria-expanded="false">' +
              '<span class="alexita-country__selected-flag" aria-hidden="true">🌐</span>' +
              '<span class="alexita-country__selected-name">' + text('countryChoose', 'Selecciona tu país') + '</span>' +
              '<span class="alexita-country__chevron" aria-hidden="true"></span>' +
            '</button>' +
            '<div class="alexita-country__panel" hidden>' +
              '<input type="search" class="alexita-country__search" placeholder="' + text('countrySearch', 'Buscar país…') + '" autocomplete="off">' +
              '<ul class="alexita-country__list" role="listbox">' + countryOptionsHtml + '</ul>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }

    function layoutCartForm(cartForm, personalizer) {
      if (!cartForm || cartForm.dataset.alexitaLayoutDone === '1') {
        return;
      }

      var scope = cartForm.closest('.elementor-widget-woocommerce-product-add-to-cart') || cartForm;
      var quantity = cartForm.querySelector('.quantity') || scope.querySelector('.quantity');
      var button = cartForm.querySelector('.single_add_to_cart_button, button[name="add-to-cart"]') ||
        scope.querySelector('.single_add_to_cart_button, button[name="add-to-cart"]');

      if (!quantity && !button) {
        return;
      }

      var actions = cartForm.querySelector('.alexita-cart-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'alexita-cart-actions';
      }

      personalizer.insertAdjacentElement('afterend', actions);

      if (quantity && quantity.parentElement !== actions) {
        actions.appendChild(quantity);
      }

      if (button && button.parentElement !== actions) {
        actions.appendChild(button);
      }

      cartForm.classList.add('alexita-cart-form');
      cartForm.dataset.alexitaLayoutDone = '1';
    }

    function reindexPlayerFields() {
      if (!wrapper) {
        return;
      }

      var players = wrapper.querySelectorAll('.alexita-player');

      players.forEach(function (player, index) {
        player.setAttribute('data-player-index', String(index));

        var badge = player.querySelector('.alexita-player__badge');
        var title = player.querySelector('.alexita-player__title');
        if (badge) badge.textContent = String(index + 1);
        if (title) title.textContent = text('player', 'Unidad') + ' ' + (index + 1);

        var nameInput = player.querySelector('[name*="[name]"]');
        var numberInput = player.querySelector('[name*="[number]"]');
        var countryInput = player.querySelector('.alexita-country__value');
        var photoUrlInput = player.querySelector('.alexita-photo-url');

        if (nameInput) {
          nameInput.name = 'alexita_players[' + index + '][name]';
          nameInput.id = 'alexita-player-name-' + index;
        }
        if (numberInput) {
          numberInput.name = 'alexita_players[' + index + '][number]';
          numberInput.id = 'alexita-player-number-' + index;
        }
        if (countryInput) {
          countryInput.name = 'alexita_players[' + index + '][country]';
        }
        if (photoUrlInput) {
          photoUrlInput.name = 'alexita_players[' + index + '][photo_url]';
        }
      });
    }

    function validatePlayersBeforeSubmit() {
      if (!wrapper) {
        return true;
      }

      reindexPlayerFields();

      var players = wrapper.querySelectorAll('.alexita-player');
      var i;

      for (i = 0; i < players.length; i++) {
        var playerNumber = i + 1;
        var countryValue = players[i].querySelector('.alexita-country__value');
        var photoUrlInput = players[i].querySelector('.alexita-photo-url');
        var fileInput = players[i].querySelector('.alexita-file__input');

        if (players[i].classList.contains('is-uploading')) {
          alert(text('uploadPending', 'Espera a que termine de subir la foto de la unidad %d.').replace('%d', String(playerNumber)));
          return false;
        }

        if (countryValue && !countryValue.value) {
          alert(text('missingCountry', 'Selecciona un país para la unidad %d.').replace('%d', String(playerNumber)));
          if (countryValue.closest('.alexita-country')) {
            var toggle = countryValue.closest('.alexita-country').querySelector('.alexita-country__toggle');
            if (toggle) toggle.focus();
          }
          return false;
        }

        if (!photoUrlInput || !photoUrlInput.value) {
          alert(text('missingPhoto', 'Falta la foto de la unidad %d.').replace('%d', String(playerNumber)));
          if (fileInput) fileInput.focus();
          return false;
        }
      }

      return true;
    }

    function prepareFormForSubmit(cartForm) {
      cartForm.setAttribute('method', 'post');
      reindexPlayerFields();
    }

    function ensureAddToCartField(cartForm, button) {
      var productId = '';

      if (button) {
        productId = button.value || button.getAttribute('value') || '';
        if (!productId && button.getAttribute('name') === 'add-to-cart') {
          productId = button.value || '';
        }
      }

      if (!productId && window.jQuery) {
        var $btn = window.jQuery(cartForm).find('.single_add_to_cart_button, button[name="add-to-cart"]').first();
        if ($btn.length) {
          productId = $btn.val() || $btn.attr('value') || $btn.data('product_id') || '';
        }
      }

      if (!productId) {
        return;
      }

      var helper = cartForm.querySelector('input.alexita-add-to-cart-helper');

      if (!helper) {
        helper = document.createElement('input');
        helper.type = 'hidden';
        helper.name = 'add-to-cart';
        helper.className = 'alexita-add-to-cart-helper';
        cartForm.appendChild(helper);
      }

      helper.value = productId;
    }

    function submitCartFormWithButton(cartForm, button) {
      ensureAddToCartField(cartForm, button);

      if (typeof cartForm.requestSubmit === 'function' && button) {
        cartForm.requestSubmit(button);
        return;
      }

      cartForm.submit();
    }

    function bindCartFormSubmit(cartForm) {
      cartForm.addEventListener('submit', function (event) {
        prepareFormForSubmit(cartForm);
        if (!validatePlayersBeforeSubmit()) {
          event.preventDefault();
        }
      });
    }

    function bindWooCommerceAddToCart(cartForm) {
      if (!window.jQuery) {
        return;
      }

      window.jQuery(document.body).on('click.alexitaPersonalizer', '.single_add_to_cart_button', function (event) {
        if (!document.getElementById('alexita-personalizer')) {
          return;
        }

        var $button = window.jQuery(this);
        var $form = $button.closest('form.cart');

        if (!$form.length || !$form.find('#alexita-personalizer').length) {
          return;
        }

        prepareFormForSubmit(cartForm);

        if (!validatePlayersBeforeSubmit()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return false;
        }

        var buttonEl = $button[0];

        // Solo interceptar AJAX (no envía archivos). El clic normal debe seguir para incluir add-to-cart.
        if ($button.hasClass('ajax_add_to_cart')) {
          event.preventDefault();
          event.stopImmediatePropagation();
          submitCartFormWithButton(cartForm, buttonEl);
          return false;
        }

        // Dejar que el submit nativo del botón envíe add-to-cart + archivos.
        ensureAddToCartField(cartForm, buttonEl);
      });
    }

    function getQuantity() {
      var qty = 1;
      if (qtyInput && qtyInput.value) {
        qty = parseInt(qtyInput.value, 10);
      }
      if (isNaN(qty) || qty < 1) qty = 1;
      return qty;
    }

    function playerTemplate(index) {
      var number = index + 1;
      return '' +
        '<div class="alexita-player" data-player-index="' + index + '">' +
          '<div class="alexita-player__head">' +
            '<span class="alexita-player__badge" aria-hidden="true">' + number + '</span>' +
            '<h4 class="alexita-player__title">' + text('player', 'Unidad') + ' ' + number + '</h4>' +
          '</div>' +
          '<div class="alexita-player__row">' +
            '<div class="alexita-field alexita-field--name">' +
              '<label for="alexita-player-name-' + index + '">' + text('name', 'Nombre') + '</label>' +
              '<input id="alexita-player-name-' + index + '" type="text" name="alexita_players[' + index + '][name]" placeholder="' + text('nameExample', 'Ej.: Alexita') + '" maxlength="30" required autocomplete="name">' +
            '</div>' +
            '<div class="alexita-field alexita-field--number">' +
              '<label for="alexita-player-number-' + index + '">' + text('number', 'Número') + '</label>' +
              '<input id="alexita-player-number-' + index + '" type="text" name="alexita_players[' + index + '][number]" placeholder="' + text('numExample', 'Ej.: 14') + '" maxlength="2" inputmode="numeric" pattern="[0-9]{1,2}" required>' +
            '</div>' +
          '</div>' +
          countryFieldHtml(index) +
          '<div class="alexita-field alexita-field--file">' +
            '<span class="alexita-field__label">' + text('photo', 'Foto del rostro') + '</span>' +
            '<div class="alexita-file">' +
              '<div class="alexita-file__preview" aria-live="polite">' +
                '<img class="alexita-file__img" alt="' + text('previewAlt', 'Vista previa de la foto') + '">' +
                '<span class="alexita-file__placeholder">' + text('previewEmpty', 'Sin foto') + '</span>' +
              '</div>' +
              '<input type="hidden" class="alexita-photo-url" name="alexita_players[' + index + '][photo_url]" value="">' +
              '<div class="alexita-file__controls">' +
                '<div class="alexita-file__picker">' +
                  '<label class="alexita-file__trigger">' +
                    '<span class="alexita-file__trigger-text">' + text('choosePhoto', 'Elegir foto') + '</span>' +
                    '<input class="alexita-file__input" id="alexita-photo-' + index + '" type="file" accept="image/jpeg,image/png,image/webp">' +
                  '</label>' +
                '</div>' +
                '<span class="alexita-file__name" data-empty="' + text('noFileSelected', 'Ninguna foto seleccionada') + '">' + text('noFileSelected', 'Ninguna foto seleccionada') + '</span>' +
              '</div>' +
            '</div>' +
            '<small>' + text('photoHint', 'JPG, PNG o WebP · máx. 2.5 MB') + '</small>' +
          '</div>' +
        '</div>';
    }

    function closeCountryPanels(except) {
      if (!wrapper) return;
      wrapper.querySelectorAll('.alexita-country').forEach(function (countryEl) {
        if (except && countryEl === except) return;
        countryEl.classList.remove('is-open');
        var panel = countryEl.querySelector('.alexita-country__panel');
        var toggle = countryEl.querySelector('.alexita-country__toggle');
        if (panel) panel.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      });
    }

    function setCountrySelection(countryEl, code, flag, name) {
      var valueInput = countryEl.querySelector('.alexita-country__value');
      var flagEl = countryEl.querySelector('.alexita-country__selected-flag');
      var nameEl = countryEl.querySelector('.alexita-country__selected-name');

      if (valueInput) valueInput.value = code;
      if (flagEl) flagEl.textContent = flag;
      if (nameEl) nameEl.textContent = name;
      countryEl.classList.add('is-selected');
    }

    function filterCountryList(countryEl, query) {
      var list = countryEl.querySelector('.alexita-country__list');
      if (!list) return;

      var normalized = query.trim().toLowerCase();
      list.querySelectorAll('.alexita-country__option').forEach(function (option) {
        var name = (option.getAttribute('data-name') || '').toLowerCase();
        var item = option.closest('li');
        if (!item) return;
        item.hidden = normalized !== '' && name.indexOf(normalized) === -1;
      });
    }

    function revokePreviewUrl(input) {
      if (!input || !input.dataset.previewUrl) return;
      URL.revokeObjectURL(input.dataset.previewUrl);
      delete input.dataset.previewUrl;
    }

    function setPreviewFromUrl(input, url, fileName) {
      var player = input.closest('.alexita-player');
      var fileWrap = input.closest('.alexita-file');
      if (!fileWrap) return;

      var nameEl = fileWrap.querySelector('.alexita-file__name');
      var imgEl = fileWrap.querySelector('.alexita-file__img');
      var placeholderEl = fileWrap.querySelector('.alexita-file__placeholder');
      var previewBox = fileWrap.querySelector('.alexita-file__preview');

      if (nameEl) {
        nameEl.textContent = fileName || url.split('/').pop();
        nameEl.classList.add('is-selected');
      }
      if (imgEl) {
        imgEl.src = url;
      }
      if (placeholderEl) {
        placeholderEl.hidden = true;
      }
      if (previewBox) {
        previewBox.classList.add('has-image');
      }
      if (player) {
        player.classList.add('is-uploaded');
      }
    }

    function clearPhotoState(input) {
      var player = input.closest('.alexita-player');
      var fileWrap = input.closest('.alexita-file');
      var photoUrlInput = player ? player.querySelector('.alexita-photo-url') : null;

      if (photoUrlInput) {
        photoUrlInput.value = '';
      }
      if (player) {
        player.classList.remove('is-uploaded', 'is-uploading');
      }

      revokePreviewUrl(input);

      if (!fileWrap) return;

      var nameEl = fileWrap.querySelector('.alexita-file__name');
      var imgEl = fileWrap.querySelector('.alexita-file__img');
      var placeholderEl = fileWrap.querySelector('.alexita-file__placeholder');
      var previewBox = fileWrap.querySelector('.alexita-file__preview');
      var emptyText = nameEl ? (nameEl.getAttribute('data-empty') || text('noFileSelected', 'Ninguna foto seleccionada')) : '';

      if (nameEl) {
        nameEl.textContent = emptyText;
        nameEl.classList.remove('is-selected');
      }
      if (imgEl) {
        imgEl.removeAttribute('src');
      }
      if (placeholderEl) {
        placeholderEl.hidden = false;
      }
      if (previewBox) {
        previewBox.classList.remove('has-image');
      }
    }

    function uploadPlayerPhoto(input) {
      if (!input || !input.files || !input.files[0]) {
        clearPhotoState(input);
        return;
      }

      if (!config.ajaxUrl || !config.uploadNonce) {
        updateFilePreviewLocal(input);
        return;
      }

      var file = input.files[0];
      var player = input.closest('.alexita-player');
      var photoUrlInput = player ? player.querySelector('.alexita-photo-url') : null;
      var triggerText = player ? player.querySelector('.alexita-file__trigger-text') : null;
      var originalLabel = triggerText ? triggerText.textContent : '';

      if (file.size > maxFileSize) {
        alert(text('fileTooLarge', 'La foto supera el máximo permitido de 2.5 MB.'));
        input.value = '';
        clearPhotoState(input);
        return;
      }

      if (photoUrlInput) {
        photoUrlInput.value = '';
      }

      updateFilePreviewLocal(input);

      if (player) {
        player.classList.add('is-uploading');
        player.classList.remove('is-uploaded');
      }
      if (triggerText) {
        triggerText.textContent = text('uploading', 'Subiendo foto…');
      }

      var body = new FormData();
      body.append('action', config.uploadAction || 'alexita_upload_player_photo');
      body.append('nonce', config.uploadNonce);
      body.append('photo', file);

      fetch(config.ajaxUrl, {
        method: 'POST',
        body: body,
        credentials: 'same-origin'
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (player) {
            player.classList.remove('is-uploading');
          }
          if (triggerText) {
            triggerText.textContent = originalLabel || text('choosePhoto', 'Elegir foto');
          }

          if (data && data.success && data.data && data.data.url) {
            if (photoUrlInput) {
              photoUrlInput.value = data.data.url;
            }
            setPreviewFromUrl(input, data.data.url, file.name);
            return;
          }

          var message = (data && data.data && data.data.message) ? data.data.message : text('uploadFailed', 'No se pudo subir la foto. Intenta de nuevo.');
          alert(message);
          input.value = '';
          clearPhotoState(input);
        })
        .catch(function () {
          if (player) {
            player.classList.remove('is-uploading');
          }
          if (triggerText) {
            triggerText.textContent = originalLabel || text('choosePhoto', 'Elegir foto');
          }
          alert(text('uploadFailed', 'No se pudo subir la foto. Intenta de nuevo.'));
          input.value = '';
          clearPhotoState(input);
        });
    }

    function updateFilePreviewLocal(input) {
      if (!input) return;

      var fileWrap = input.closest('.alexita-file');
      if (!fileWrap) return;

      var nameEl = fileWrap.querySelector('.alexita-file__name');
      var imgEl = fileWrap.querySelector('.alexita-file__img');
      var placeholderEl = fileWrap.querySelector('.alexita-file__placeholder');
      var previewBox = fileWrap.querySelector('.alexita-file__preview');
      var emptyText = nameEl ? (nameEl.getAttribute('data-empty') || text('noFileSelected', 'Ninguna foto seleccionada')) : '';

      revokePreviewUrl(input);

      if (!input.files || !input.files[0]) {
        return;
      }

      var file = input.files[0];
      var objectUrl = URL.createObjectURL(file);
      input.dataset.previewUrl = objectUrl;

      if (nameEl) {
        nameEl.textContent = file.name;
        nameEl.classList.add('is-selected');
      }
      if (imgEl) {
        imgEl.src = objectUrl;
      }
      if (placeholderEl) {
        placeholderEl.hidden = true;
      }
      if (previewBox) {
        previewBox.classList.add('has-image');
      }
    }

    function syncPlayers() {
      if (!wrapper) return;

      var qty = getQuantity();
      var current = wrapper.children.length;

      while (current < qty) {
        wrapper.insertAdjacentHTML('beforeend', playerTemplate(current));
        current++;
      }

      while (current > qty) {
        var last = wrapper.lastElementChild;
        if (last) {
          var fileInput = last.querySelector('input[type="file"]');
          revokePreviewUrl(fileInput);
        }
        wrapper.removeChild(last);
        current--;
      }

      reindexPlayerFields();
    }

    function handleFileInputChange(event) {
      var input = event.target;
      if (!input || input.type !== 'file') return;

      if (!input.files || !input.files[0]) {
        clearPhotoState(input);
        return;
      }

      uploadPlayerPhoto(input);
    }

    if (wrapper) {
      wrapper.addEventListener('change', handleFileInputChange);

      wrapper.addEventListener('click', function (event) {
        var toggle = event.target.closest('.alexita-country__toggle');
        if (toggle) {
          event.preventDefault();
          var countryEl = toggle.closest('.alexita-country');
          if (!countryEl) return;

          var panel = countryEl.querySelector('.alexita-country__panel');
          var isOpen = countryEl.classList.contains('is-open');

          closeCountryPanels();
          if (!isOpen && panel) {
            countryEl.classList.add('is-open');
            panel.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
            var search = panel.querySelector('.alexita-country__search');
            if (search) {
              search.value = '';
              filterCountryList(countryEl, '');
              search.focus();
            }
          }
          return;
        }

        var option = event.target.closest('.alexita-country__option');
        if (option) {
          event.preventDefault();
          var countryWrap = option.closest('.alexita-country');
          if (!countryWrap) return;

          setCountrySelection(
            countryWrap,
            option.getAttribute('data-code') || '',
            option.getAttribute('data-flag') || '',
            option.getAttribute('data-name') || ''
          );
          closeCountryPanels();
        }
      });

      wrapper.addEventListener('input', function (event) {
        if (event.target.classList.contains('alexita-country__search')) {
          var countryEl = event.target.closest('.alexita-country');
          if (countryEl) {
            filterCountryList(countryEl, event.target.value);
          }
        }
      });
    }

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.alexita-country')) {
        closeCountryPanels();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeCountryPanels();
      }
    });

    function bindQuantitySync() {
      if (!form) return;

      form.addEventListener('click', function (event) {
        if (event.target.closest('.quantity, .qty, input.qty, .plus, .minus')) {
          window.setTimeout(syncPlayers, 80);
        }
      });

      if (qtyInput) {
        qtyInput.addEventListener('change', syncPlayers);
        qtyInput.addEventListener('input', syncPlayers);
      }
    }

    function cleanEcomusStickyBar() {
      var selectors = '.ecomus-sticky-atc, .ecomus-sticky-atc__content, .ecomus-sticky-add-to-cart';
      document.querySelectorAll(selectors).forEach(function (sticky) {
        sticky.querySelectorAll('#alexita-personalizer, .alexita-personalizer').forEach(function (node) {
          node.remove();
        });

        sticky.querySelectorAll('.alexita-players-wrapper, .alexita-player').forEach(function (node) {
          node.remove();
        });

        var actions = sticky.querySelector('.alexita-cart-actions');
        if (actions) {
          actions.style.display = 'flex';
        }
      });
    }

    function bindEcomusStickyAddToCart(mainForm) {
      document.addEventListener('click', function (event) {
        if (!document.getElementById('alexita-personalizer')) {
          return;
        }

        var button = event.target.closest(
          '.ecomus-sticky-atc .single_add_to_cart_button, .ecomus-sticky-atc__content .single_add_to_cart_button, .ecomus-sticky-add-to-cart .single_add_to_cart_button'
        );

        if (!button) {
          return;
        }

        var stickyForm = button.closest('form.cart');
        if (!stickyForm || stickyForm === mainForm) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        var stickyQty = stickyForm.querySelector('input.qty');
        var mainQty = mainForm.querySelector('input.qty');

        if (stickyQty && mainQty) {
          mainQty.value = stickyQty.value;
          syncPlayers();
        }

        prepareFormForSubmit(mainForm);

        if (!validatePlayersBeforeSubmit()) {
          return false;
        }

        var mainButton = mainForm.querySelector('.single_add_to_cart_button, button[name="add-to-cart"]');
        ensureAddToCartField(mainForm, mainButton);

        if (typeof mainForm.requestSubmit === 'function' && mainButton) {
          mainForm.requestSubmit(mainButton);
        } else {
          mainForm.submit();
        }

        return false;
      }, true);
    }

    function watchEcomusStickyBar() {
      cleanEcomusStickyBar();

      if (typeof MutationObserver === 'undefined') {
        return;
      }

      var observer = new MutationObserver(function () {
        cleanEcomusStickyBar();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    bindQuantitySync();
    syncPlayers();
    watchEcomusStickyBar();

    if (form) {
      bindEcomusStickyAddToCart(form);
    }
  });
})();
