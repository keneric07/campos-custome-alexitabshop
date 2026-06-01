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
          '<h4>' + text('player', 'Jugador') + ' ' + number + '</h4>' +
          '<div class="alexita-field">' +
            '<label for="alexita-player-name-' + index + '">' + text('name', 'Nombre del jugador') + '</label>' +
            '<input id="alexita-player-name-' + index + '" type="text" name="alexita_players[' + index + '][name]" placeholder="' + text('nameExample', 'Ejemplo: Annie') + '" maxlength="30" required>' +
          '</div>' +
          '<div class="alexita-field">' +
            '<label for="alexita-player-number-' + index + '">' + text('number', 'Número del jugador') + '</label>' +
            '<input id="alexita-player-number-' + index + '" type="text" name="alexita_players[' + index + '][number]" placeholder="' + text('numExample', 'Ejemplo: 14') + '" maxlength="2" inputmode="numeric" pattern="[0-9]{1,2}" required>' +
          '</div>' +
          '<div class="alexita-field">' +
            '<label for="alexita-player-photo-' + index + '">' + text('photo', 'Foto del rostro') + '</label>' +
            '<input id="alexita-player-photo-' + index + '" type="file" name="alexita_players[' + index + '][photo]" accept="image/jpeg,image/png,image/webp" required>' +
            '<small>JPG, PNG o WebP. Máximo 2.5 MB.</small>' +
          '</div>' +
        '</div>';
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
      if (!input || input.type !== 'file' || !input.files || !input.files[0]) return;

      if (input.files[0].size > maxFileSize) {
        alert(text('fileTooLarge', 'La foto supera el máximo permitido de 2.5 MB.'));
        input.value = '';
      }
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
