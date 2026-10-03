(function () {
    var toggle = document.getElementById("toggle");
    var nav = document.getElementById("nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
        nav.classList.toggle("-right-full", !open);
        nav.classList.toggle("right-0", open);
        nav.classList.toggle("invisible", !open);
        toggle.setAttribute("aria-expanded", String(open));
    }

    toggle.addEventListener("click", function () {
        setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
            setOpen(false);
            toggle.focus();
        }
    });
})();
