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
    var labels = (window.AlexitaPersonalizer && window.AlexitaPersonalizer.labels) ? window.AlexitaPersonalizer.labels : {};

    if (form) {
      form.setAttribute('enctype', 'multipart/form-data');
    }

    function text(key, fallback) {
      return labels[key] || fallback;
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
          '<div class="alexita-field">' +
            '<label for="alexita-player-name-' + index + '">' + text('name', 'Nombre') + '</label>' +
            '<input id="alexita-player-name-' + index + '" type="text" name="alexita_players[' + index + '][name]" placeholder="' + text('nameExample', 'Ej.: Annie') + '" maxlength="30" required autocomplete="name">' +
          '</div>' +
          '<div class="alexita-field">' +
            '<label for="alexita-player-number-' + index + '">' + text('number', 'Número') + '</label>' +
            '<input id="alexita-player-number-' + index + '" type="text" name="alexita_players[' + index + '][number]" placeholder="' + text('numExample', 'Ej.: 14') + '" maxlength="2" inputmode="numeric" pattern="[0-9]{1,2}" required>' +
          '</div>' +
          '<div class="alexita-field alexita-field--file">' +
            '<label for="alexita-player-photo-' + index + '">' + text('photo', 'Foto del rostro') + '</label>' +
            '<div class="alexita-file">' +
              '<label class="alexita-file__trigger" for="alexita-player-photo-' + index + '">' + text('choosePhoto', 'Elegir foto') + '</label>' +
              '<input class="alexita-file__input" id="alexita-player-photo-' + index + '" type="file" name="alexita_players[' + index + '][photo]" accept="image/jpeg,image/png,image/webp" required>' +
              '<span class="alexita-file__name" data-empty="' + text('noFileSelected', 'Ninguna foto seleccionada') + '">' + text('noFileSelected', 'Ninguna foto seleccionada') + '</span>' +
            '</div>' +
            '<small>' + text('photoHint', 'JPG, PNG o WebP · máx. 2.5 MB') + '</small>' +
          '</div>' +
        '</div>';
    }

    function updateFileNameDisplay(input) {
      if (!input) return;
      var fileWrap = input.closest('.alexita-file');
      if (!fileWrap) return;
      var nameEl = fileWrap.querySelector('.alexita-file__name');
      if (!nameEl) return;

      var emptyText = nameEl.getAttribute('data-empty') || text('noFileSelected', 'Ninguna foto seleccionada');

      if (input.files && input.files[0]) {
        nameEl.textContent = input.files[0].name;
        nameEl.classList.add('is-selected');
      } else {
        nameEl.textContent = emptyText;
        nameEl.classList.remove('is-selected');
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
        wrapper.removeChild(wrapper.lastElementChild);
        current--;
      }
    }

    function validateFileSize(event) {
      var input = event.target;
      if (!input || input.type !== 'file' || !input.files || !input.files[0]) {
        updateFileNameDisplay(input);
        return;
      }

      if (input.files[0].size > maxFileSize) {
        alert(text('fileTooLarge', 'La foto supera el máximo permitido de 2.5 MB.'));
        input.value = '';
      }

      updateFileNameDisplay(input);
    }

    if (qtyInput) {
      qtyInput.addEventListener('change', syncPlayers);
      qtyInput.addEventListener('input', syncPlayers);
      qtyInput.addEventListener('keyup', syncPlayers);
    }

    if (wrapper) {
      wrapper.addEventListener('change', validateFileSize);
    }

    document.body.addEventListener('click', function () {
      window.setTimeout(syncPlayers, 120);
    });

    syncPlayers();
  });
})();
