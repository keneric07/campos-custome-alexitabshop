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
      form.setAttribute('enctype', 'multipart/form-data');
      layoutCartForm(form, box);
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

      var quantity = cartForm.querySelector('.quantity');
      var button = cartForm.querySelector('.single_add_to_cart_button, button[name="add-to-cart"]');

      if (!quantity && !button) {
        return;
      }

      var actions = cartForm.querySelector('.alexita-cart-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'alexita-cart-actions';
        cartForm.appendChild(actions);
      }

      if (quantity && quantity.parentElement !== actions) {
        actions.appendChild(quantity);
      }

      if (button && button.parentElement !== actions) {
        actions.appendChild(button);
      }

      personalizer.insertAdjacentElement('afterend', actions);

      cartForm.classList.add('alexita-cart-form');
      cartForm.dataset.alexitaLayoutDone = '1';
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
              '<input id="alexita-player-name-' + index + '" type="text" name="alexita_players[' + index + '][name]" placeholder="' + text('nameExample', 'Ej.: Annie') + '" maxlength="30" required autocomplete="name">' +
            '</div>' +
            '<div class="alexita-field alexita-field--number">' +
              '<label for="alexita-player-number-' + index + '">' + text('number', 'Número') + '</label>' +
              '<input id="alexita-player-number-' + index + '" type="text" name="alexita_players[' + index + '][number]" placeholder="' + text('numExample', 'Ej.: 14') + '" maxlength="2" inputmode="numeric" pattern="[0-9]{1,2}" required>' +
            '</div>' +
          '</div>' +
          countryFieldHtml(index) +
          '<div class="alexita-field alexita-field--file">' +
            '<label for="alexita-player-photo-' + index + '">' + text('photo', 'Foto del rostro') + '</label>' +
            '<div class="alexita-file">' +
              '<div class="alexita-file__preview" aria-live="polite">' +
                '<img class="alexita-file__img" alt="' + text('previewAlt', 'Vista previa de la foto') + '" hidden>' +
                '<span class="alexita-file__placeholder">' + text('previewEmpty', 'Sin foto') + '</span>' +
              '</div>' +
              '<div class="alexita-file__controls">' +
                '<label class="alexita-file__trigger" for="alexita-player-photo-' + index + '">' + text('choosePhoto', 'Elegir foto') + '</label>' +
                '<input class="alexita-file__input" id="alexita-player-photo-' + index + '" type="file" name="alexita_players[' + index + '][photo]" accept="image/jpeg,image/png,image/webp" required>' +
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

    function updateFilePreview(input) {
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
        if (nameEl) {
          nameEl.textContent = emptyText;
          nameEl.classList.remove('is-selected');
        }
        if (imgEl) {
          imgEl.removeAttribute('src');
          imgEl.hidden = true;
        }
        if (placeholderEl) {
          placeholderEl.hidden = false;
        }
        if (previewBox) {
          previewBox.classList.remove('has-image');
        }
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
        imgEl.hidden = false;
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
    }

    function validateFileSize(event) {
      var input = event.target;
      if (!input || input.type !== 'file') return;

      if (!input.files || !input.files[0]) {
        updateFilePreview(input);
        return;
      }

      if (input.files[0].size > maxFileSize) {
        alert(text('fileTooLarge', 'La foto supera el máximo permitido de 2.5 MB.'));
        input.value = '';
      }

      updateFilePreview(input);
    }

    if (wrapper) {
      wrapper.addEventListener('change', validateFileSize);

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

    if (qtyInput) {
      qtyInput.addEventListener('change', syncPlayers);
      qtyInput.addEventListener('input', syncPlayers);
      qtyInput.addEventListener('keyup', syncPlayers);
    }

    document.body.addEventListener('click', function () {
      window.setTimeout(syncPlayers, 120);
    });

    syncPlayers();
  });
})();
