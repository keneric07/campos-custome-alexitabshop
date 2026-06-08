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
    var activeCountryEl = null;
    var countryModal = null;

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

    function buildCountryOptionButton(country, extraClass) {
      var cls = 'alexita-country-modal__option' + (extraClass ? ' ' + extraClass : '');
      return (
        '<li role="presentation">' +
          '<button type="button" class="' + cls + '" role="option" ' +
            'data-code="' + escapeAttr(country.code) + '" ' +
            'data-flag="' + escapeAttr(country.flag) + '" ' +
            'data-name="' + escapeAttr(country.name) + '" ' +
            'aria-selected="false">' +
            '<span class="alexita-country-modal__flag" aria-hidden="true">' + country.flag + '</span>' +
            '<span class="alexita-country-modal__name">' + country.name + '</span>' +
            '<span class="alexita-country-modal__check" aria-hidden="true"></span>' +
          '</button>' +
        '</li>'
      );
    }

    function buildCountryModalListHtml(list) {
      if (!list.length) {
        return '';
      }

      var featured = list.filter(function (c) { return c.featured; });
      var hosts = list.filter(function (c) { return c.host && !c.featured; });
      var others = list.filter(function (c) { return !c.host && !c.featured; });
      var html = '';

      if (featured.length) {
        html += featured.map(function (country) {
          return buildCountryOptionButton(country, 'alexita-country-modal__option--featured');
        }).join('');
      }

      if (hosts.length) {
        html += '<li class="alexita-country-modal__section" role="presentation">' +
          '<span class="alexita-country-modal__section-label">' + text('countryHosts', 'Anfitriones') + '</span>' +
        '</li>';
        html += hosts.map(function (country) {
          return buildCountryOptionButton(country, 'alexita-country-modal__option--host');
        }).join('');
      }

      if (others.length) {
        html += '<li class="alexita-country-modal__section" role="presentation">' +
          '<span class="alexita-country-modal__section-label">' + text('countryAll', 'Todos los países') + '</span>' +
        '</li>';
        html += others.map(function (country) {
          return buildCountryOptionButton(country);
        }).join('');
      }

      return html;
    }

    function ensureCountryModal() {
      if (countryModal) {
        return countryModal;
      }

      var listHtml = buildCountryModalListHtml(countries);
      var modalHtml =
        '<div id="alexita-country-modal" class="alexita-country-modal" hidden aria-hidden="true">' +
          '<div class="alexita-country-modal__backdrop" data-dismiss="country-modal"></div>' +
          '<div class="alexita-country-modal__sheet" role="dialog" aria-modal="true" aria-labelledby="alexita-country-modal-title">' +
            '<div class="alexita-country-modal__handle" aria-hidden="true"></div>' +
            '<header class="alexita-country-modal__header">' +
              '<button type="button" class="alexita-country-modal__cancel" data-dismiss="country-modal">' +
                text('countryCancel', 'Cancelar') +
              '</button>' +
              '<h2 id="alexita-country-modal-title" class="alexita-country-modal__title">' +
                text('countryModalTitle', 'Elige tu país') +
              '</h2>' +
              '<span class="alexita-country-modal__header-spacer" aria-hidden="true"></span>' +
            '</header>' +
            '<div class="alexita-country-modal__search-wrap">' +
              '<span class="alexita-country-modal__search-icon" aria-hidden="true"></span>' +
              '<input type="search" class="alexita-country-modal__search" placeholder="' + text('countrySearch', 'Buscar país…') + '" autocomplete="off" enterkeyhint="search">' +
            '</div>' +
            '<ul class="alexita-country-modal__list" role="listbox">' + listHtml + '</ul>' +
            '<p class="alexita-country-modal__empty" hidden>' + text('countryNoResults', 'Ningún país coincide') + '</p>' +
          '</div>' +
        '</div>';

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      countryModal = document.getElementById('alexita-country-modal');
      bindCountryModalEvents();
      return countryModal;
    }

    function bindCountryModalEvents() {
      if (!countryModal) return;

      countryModal.addEventListener('click', function (event) {
        if (event.target.closest('[data-dismiss="country-modal"]')) {
          event.preventDefault();
          closeCountryModal();
          return;
        }

        var option = event.target.closest('.alexita-country-modal__option');
        if (option && activeCountryEl) {
          event.preventDefault();
          setCountrySelection(
            activeCountryEl,
            option.getAttribute('data-code') || '',
            option.getAttribute('data-flag') || '',
            option.getAttribute('data-name') || ''
          );
          closeCountryModal();
        }
      });

      var search = countryModal.querySelector('.alexita-country-modal__search');
      if (search) {
        search.addEventListener('input', function () {
          filterCountryModal(search.value);
        });
      }
    }

    function isPlayerUsingCountryList(player) {
      var check = player ? player.querySelector('.alexita-country-mode__check') : null;
      return check ? check.checked : true;
    }

    function getActiveCountryInput(player) {
      if (!player) {
        return null;
      }

      if (isPlayerUsingCountryList(player)) {
        return player.querySelector('.alexita-country__value');
      }

      return player.querySelector('.alexita-country__text');
    }

    function resetCountryListSelection(countryEl) {
      if (!countryEl) {
        return;
      }

      var valueInput = countryEl.querySelector('.alexita-country__value');
      var flagEl = countryEl.querySelector('.alexita-country__selected-flag');
      var nameEl = countryEl.querySelector('.alexita-country__selected-name');
      var hintEl = countryEl.querySelector('.alexita-country__selected-hint');

      if (valueInput) {
        valueInput.value = '';
      }
      if (flagEl) {
        flagEl.textContent = '🌐';
      }
      if (nameEl) {
        nameEl.textContent = text('countryChoose', 'Selecciona tu país favorito');
      }
      if (hintEl) {
        hintEl.textContent = text('countryModalTitle', 'Elige tu país favorito');
      }

      countryEl.classList.remove('is-selected');
    }

    function setPlayerCountryMode(player, useList) {
      if (!player) {
        return;
      }

      var listWrap = player.querySelector('.alexita-country-list-wrap');
      var textWrap = player.querySelector('.alexita-country-text-wrap');
      var listInput = player.querySelector('.alexita-country__value');
      var textInput = player.querySelector('.alexita-country__text');
      var countryEl = player.querySelector('.alexita-country');
      var index = player.getAttribute('data-player-index') || '0';
      var countryName = 'alexita_players[' + index + '][country]';

      if (listWrap) {
        listWrap.hidden = !useList;
      }
      if (textWrap) {
        textWrap.hidden = useList;
      }

      if (useList) {
        if (textInput) {
          textInput.value = '';
          textInput.removeAttribute('name');
          textInput.removeAttribute('required');
        }
        if (listInput) {
          listInput.setAttribute('name', countryName);
          listInput.setAttribute('required', 'required');
        }
      } else {
        if (listInput) {
          listInput.value = '';
          listInput.removeAttribute('name');
          listInput.removeAttribute('required');
        }
        resetCountryListSelection(countryEl);
        if (textInput) {
          textInput.setAttribute('name', countryName);
          textInput.setAttribute('required', 'required');
        }
      }
    }

    function countryFieldHtml(index) {
      return (
        '<div class="alexita-field alexita-field--country-wrap">' +
          '<label class="alexita-country-mode">' +
            '<input type="checkbox" class="alexita-country-mode__check" name="alexita_players[' + index + '][worldcup_list]" value="1" checked>' +
            '<span class="alexita-country-mode__text">' + text('worldcupCheck', 'El país clasificó al Mundial 2026') + '</span>' +
          '</label>' +
          '<div class="alexita-country-list-wrap">' +
            '<div class="alexita-field alexita-field--country">' +
              '<label>' + text('country', 'País favorito') + '</label>' +
              '<div class="alexita-country">' +
                '<input type="hidden" class="alexita-country__value" name="alexita_players[' + index + '][country]" value="" required>' +
                '<button type="button" class="alexita-country__trigger" aria-haspopup="dialog">' +
                  '<span class="alexita-country__trigger-inner">' +
                    '<span class="alexita-country__selected-flag" aria-hidden="true">🌐</span>' +
                    '<span class="alexita-country__selected-text">' +
                      '<span class="alexita-country__selected-name">' + text('countryChoose', 'Selecciona tu país favorito') + '</span>' +
                      '<span class="alexita-country__selected-hint">' + text('countryModalTitle', 'Elige tu país favorito') + '</span>' +
                    '</span>' +
                  '</span>' +
                  '<span class="alexita-country__chevron" aria-hidden="true"></span>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="alexita-country-text-wrap" hidden>' +
            '<div class="alexita-field alexita-field--country alexita-field--country-text">' +
              '<label for="alexita-player-country-' + index + '">' + text('country', 'País favorito') + '</label>' +
              '<input id="alexita-player-country-' + index + '" type="text" class="alexita-country__text" placeholder="' + text('countryTextPlaceholder', 'Ej.: Colombia') + '" maxlength="50" autocomplete="country-name">' +
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

      var stack = cartForm.querySelector('.alexita-checkout-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.className = 'alexita-checkout-stack';
        personalizer.parentNode.insertBefore(stack, personalizer);
        stack.appendChild(personalizer);
      }

      stack.appendChild(actions);

      if (quantity && quantity.parentElement !== actions) {
        actions.appendChild(quantity);
      }

      if (button && button.parentElement !== actions) {
        actions.appendChild(button);
      }

      hideDuplicateAtcOutsideStack(stack, scope);
      cartForm.classList.add('alexita-cart-form');
      cartForm.dataset.alexitaLayoutDone = '1';
    }

    function hideDuplicateAtcOutsideStack(stack, scope) {
      var root = scope || document;
      var selectors = '.quantity, .single_add_to_cart_button, button[name="add-to-cart"]';

      root.querySelectorAll(selectors).forEach(function (el) {
        if (stack.contains(el)) {
          return;
        }
        if (el.closest('.ecomus-sticky-atc, .ecomus-sticky-atc__content, .ecomus-sticky-add-to-cart')) {
          return;
        }

        var holder = el.closest('.ecomus-atc-button, .product-atc-row, .woocommerce-variation-add-to-cart');
        if (!holder) {
          holder = el.parentElement;
        }

        if (holder && !stack.contains(holder)) {
          holder.classList.add('alexita-atc-hidden-duplicate');
        }
      });
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
        var worldcupCheck = player.querySelector('.alexita-country-mode__check');
        var countryTextInput = player.querySelector('.alexita-country__text');
        var countryLabel = player.querySelector('.alexita-field--country-text label');
        var photoUrlInput = player.querySelector('.alexita-photo-url');

        if (nameInput) {
          nameInput.name = 'alexita_players[' + index + '][name]';
          nameInput.id = 'alexita-player-name-' + index;
        }
        if (numberInput) {
          numberInput.name = 'alexita_players[' + index + '][number]';
          numberInput.id = 'alexita-player-number-' + index;
        }
        if (worldcupCheck) {
          worldcupCheck.name = 'alexita_players[' + index + '][worldcup_list]';
        }
        if (countryTextInput) {
          countryTextInput.id = 'alexita-player-country-' + index;
          if (countryLabel) {
            countryLabel.setAttribute('for', 'alexita-player-country-' + index);
          }
        }
        setPlayerCountryMode(player, isPlayerUsingCountryList(player));
        if (photoUrlInput) {
          photoUrlInput.name = 'alexita_players[' + index + '][photo_url]';
        }

        var fileInput = player.querySelector('.alexita-file__input');
        var photoId = 'alexita-photo-' + index;

        if (fileInput) {
          fileInput.id = photoId;
        }

        player.querySelectorAll('.alexita-file__preview, .alexita-file__btn').forEach(function (label) {
          label.setAttribute('for', photoId);
        });
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
        var countryValue = getActiveCountryInput(players[i]);
        var photoUrlInput = players[i].querySelector('.alexita-photo-url');
        var fileInput = players[i].querySelector('.alexita-file__input');
        var useList = isPlayerUsingCountryList(players[i]);

        if (players[i].classList.contains('is-uploading')) {
          alert(text('uploadPending', 'Espera a que termine de subir la foto de la unidad %d.').replace('%d', String(playerNumber)));
          return false;
        }

        if (countryValue && !countryValue.value.trim()) {
          var countryMessage = useList
            ? text('missingCountry', 'Selecciona un país para la unidad %d.')
            : text('missingCountryText', 'Escribe el país para la unidad %d.');
          alert(countryMessage.replace('%d', String(playerNumber)));
          if (useList && countryValue.closest('.alexita-country')) {
            openCountryModal(countryValue.closest('.alexita-country'));
          } else if (countryValue) {
            countryValue.focus();
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
              '<label for="alexita-player-name-' + index + '">' + text('name', 'Tu Nombre') + '</label>' +
              '<input id="alexita-player-name-' + index + '" type="text" name="alexita_players[' + index + '][name]" placeholder="' + text('nameExample', 'Ej.: Alexita') + '" maxlength="30" required autocomplete="name">' +
            '</div>' +
            '<div class="alexita-field alexita-field--number">' +
              '<label for="alexita-player-number-' + index + '">' + text('number', 'Tu número favorito') + '</label>' +
              '<input id="alexita-player-number-' + index + '" type="text" name="alexita_players[' + index + '][number]" placeholder="' + text('numExample', 'Ej.: 14') + '" maxlength="2" inputmode="numeric" pattern="[0-9]{1,2}" required>' +
            '</div>' +
          '</div>' +
          countryFieldHtml(index) +
          '<div class="alexita-field alexita-field--file">' +
            '<span class="alexita-field__label">' + text('photo', 'Foto del rostro') + '</span>' +
            '<div class="alexita-file">' +
              '<input class="alexita-file__input alexita-file__input--hidden" id="alexita-photo-' + index + '" type="file" accept="image/jpeg,image/png,image/webp">' +
              '<label class="alexita-file__preview" for="alexita-photo-' + index + '" aria-label="' + text('choosePhoto', 'Elegir foto') + '">' +
                '<img class="alexita-file__img" alt="' + text('previewAlt', 'Vista previa de la foto') + '">' +
                '<span class="alexita-file__placeholder">' +
                  '<span class="alexita-file__preview-icon" aria-hidden="true"></span>' +
                  '<span class="alexita-file__preview-text">' + text('previewEmpty', 'Sin foto') + '</span>' +
                  '<span class="alexita-file__preview-hint">' + text('photoTapUpload', 'Toca para subir') + '</span>' +
                '</span>' +
                '<span class="alexita-file__preview-change">' + text('changePhoto', 'Cambiar foto') + '</span>' +
              '</label>' +
              '<input type="hidden" class="alexita-photo-url" name="alexita_players[' + index + '][photo_url]" value="">' +
              '<div class="alexita-file__controls">' +
                '<label class="alexita-file__btn" for="alexita-photo-' + index + '">' +
                  '<span class="alexita-file__btn-icon" aria-hidden="true"></span>' +
                  '<span class="alexita-file__btn-text">' + text('choosePhoto', 'Elegir foto') + '</span>' +
                '</label>' +
                '<span class="alexita-file__name" data-empty="' + text('noFileSelected', 'Ninguna foto seleccionada') + '">' + text('noFileSelected', 'Ninguna foto seleccionada') + '</span>' +
              '</div>' +
            '</div>' +
            '<small>' + text('photoHint', 'JPG, PNG o WebP · máx. 2.5 MB') + '</small>' +
          '</div>' +
        '</div>';
    }

    function openCountryModal(countryEl) {
      if (!countryEl) return;

      var modal = ensureCountryModal();
      activeCountryEl = countryEl;

      var valueInput = countryEl.querySelector('.alexita-country__value');
      var currentCode = valueInput ? valueInput.value : '';

      modal.querySelectorAll('.alexita-country-modal__option').forEach(function (option) {
        var isSelected = currentCode && option.getAttribute('data-code') === currentCode;
        option.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        option.classList.toggle('is-selected', isSelected);
      });

      var search = modal.querySelector('.alexita-country-modal__search');
      if (search) {
        search.value = '';
        filterCountryModal('');
      }

      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('is-open');
      document.documentElement.classList.add('alexita-country-modal-open');

      window.requestAnimationFrame(function () {
        if (search) {
          search.focus();
        }
      });
    }

    function closeCountryModal() {
      if (!countryModal) return;

      countryModal.classList.remove('is-open');
      countryModal.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('alexita-country-modal-open');

      var trigger = activeCountryEl ? activeCountryEl.querySelector('.alexita-country__trigger') : null;

      window.setTimeout(function () {
        if (countryModal && !countryModal.classList.contains('is-open')) {
          countryModal.hidden = true;
        }
        if (trigger) {
          trigger.focus();
        }
        activeCountryEl = null;
      }, 400);
    }

    function setCountrySelection(countryEl, code, flag, name) {
      var valueInput = countryEl.querySelector('.alexita-country__value');
      var flagEl = countryEl.querySelector('.alexita-country__selected-flag');
      var nameEl = countryEl.querySelector('.alexita-country__selected-name');
      var hintEl = countryEl.querySelector('.alexita-country__selected-hint');

      if (valueInput) valueInput.value = code;
      if (flagEl) flagEl.textContent = flag;
      if (nameEl) nameEl.textContent = name;
      if (hintEl) hintEl.textContent = code;
      countryEl.classList.add('is-selected');
    }

    function filterCountryModal(query) {
      if (!countryModal) return;

      var normalized = query.trim().toLowerCase();
      var visibleCount = 0;
      var sections = countryModal.querySelectorAll('.alexita-country-modal__section');

      countryModal.querySelectorAll('.alexita-country-modal__option').forEach(function (option) {
        var name = (option.getAttribute('data-name') || '').toLowerCase();
        var code = (option.getAttribute('data-code') || '').toLowerCase();
        var item = option.closest('li');
        var matches = normalized === '' || name.indexOf(normalized) !== -1 || code.indexOf(normalized) !== -1;

        if (item) {
          item.hidden = !matches;
        }
        if (matches) {
          visibleCount++;
        }
      });

      sections.forEach(function (section) {
        var next = section.nextElementSibling;
        var hasVisible = false;

        while (next && !next.classList.contains('alexita-country-modal__section')) {
          if (!next.hidden && next.querySelector('.alexita-country-modal__option')) {
            hasVisible = true;
            break;
          }
          next = next.nextElementSibling;
        }

        section.hidden = !hasVisible;
      });

      var emptyEl = countryModal.querySelector('.alexita-country-modal__empty');
      var listEl = countryModal.querySelector('.alexita-country-modal__list');

      if (emptyEl) {
        emptyEl.hidden = visibleCount > 0;
      }
      if (listEl) {
        listEl.hidden = visibleCount === 0;
      }
    }

    function revokePreviewUrl(input) {
      if (!input || !input.dataset.previewUrl) return;
      URL.revokeObjectURL(input.dataset.previewUrl);
      delete input.dataset.previewUrl;
    }

    function setFileButtonLabel(player, uploaded) {
      if (!player) return;
      var btnText = player.querySelector('.alexita-file__btn-text');
      if (btnText) {
        btnText.textContent = uploaded
          ? text('changePhoto', 'Cambiar foto')
          : text('choosePhoto', 'Elegir foto');
      }
    }

    function setPreviewFromUrl(input, url, fileName) {
      var player = input.closest('.alexita-player');
      var fileWrap = input.closest('.alexita-file');
      if (!fileWrap) return;

      var nameEl = fileWrap.querySelector('.alexita-file__name');
      var imgEl = fileWrap.querySelector('.alexita-file__img');
      var previewBox = fileWrap.querySelector('.alexita-file__preview');

      if (nameEl) {
        nameEl.textContent = fileName || url.split('/').pop();
        nameEl.classList.add('is-selected');
      }
      if (imgEl) {
        imgEl.src = url;
      }
      if (previewBox) {
        previewBox.classList.add('has-image');
      }
      if (player) {
        player.classList.add('is-uploaded');
      }
      setFileButtonLabel(player, true);
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
      var previewBox = fileWrap.querySelector('.alexita-file__preview');
      var emptyText = nameEl ? (nameEl.getAttribute('data-empty') || text('noFileSelected', 'Ninguna foto seleccionada')) : '';

      if (nameEl) {
        nameEl.textContent = emptyText;
        nameEl.classList.remove('is-selected');
      }
      if (imgEl) {
        imgEl.removeAttribute('src');
      }
      if (previewBox) {
        previewBox.classList.remove('has-image');
      }
      setFileButtonLabel(player, false);
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
      var triggerText = player ? player.querySelector('.alexita-file__btn-text') : null;
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
      var previewBox = fileWrap.querySelector('.alexita-file__preview');
      var player = input.closest('.alexita-player');
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
      if (previewBox) {
        previewBox.classList.add('has-image');
      }
      setFileButtonLabel(player, true);
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

    function handleWrapperChange(event) {
      var input = event.target;
      if (!input) {
        return;
      }

      if (input.classList && input.classList.contains('alexita-country-mode__check')) {
        var player = input.closest('.alexita-player');
        setPlayerCountryMode(player, input.checked);
        return;
      }

      if (input.type !== 'file') {
        return;
      }

      if (!input.files || !input.files[0]) {
        clearPhotoState(input);
        return;
      }

      uploadPlayerPhoto(input);
    }

    if (wrapper) {
      wrapper.addEventListener('change', handleWrapperChange);

      wrapper.addEventListener('click', function (event) {
        var trigger = event.target.closest('.alexita-country__trigger');
        if (trigger) {
          event.preventDefault();
          var countryEl = trigger.closest('.alexita-country');
          if (countryEl) {
            openCountryModal(countryEl);
          }
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && countryModal && countryModal.classList.contains('is-open')) {
        closeCountryModal();
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
    ensureCountryModal();
    watchEcomusStickyBar();

    if (form) {
      bindEcomusStickyAddToCart(form);
    }
  });
})();
