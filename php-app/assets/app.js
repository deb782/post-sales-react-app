// Real Estate Dashboard — vanilla JS helpers (no framework)

// Open / close modal by id
function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('show');
}

function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('show');
}

// Close modal on backdrop click or Escape
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('show');
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.show').forEach(function (el) { el.classList.remove('show'); });
    }
});

// Confirm before submitting a form marked with data-confirm
document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute('data-confirm');
    if (msg && ! confirm(msg)) e.preventDefault();
});

// Auto-submit filter forms on select change
document.addEventListener('change', function (e) {
    if (e.target.matches('form[data-autosubmit] select')) e.target.form.submit();
});
