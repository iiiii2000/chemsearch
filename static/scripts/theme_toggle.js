const theme_toggle = document.getElementById('theme-toggle');
const toggle_icon = document.getElementById('toggle-icon');
const htmlElement = document.documentElement;

// Add click event to the button
theme_toggle.addEventListener('click', () => {
    // Change between dark/light
    const currentTheme = htmlElement.getAttribute("data-bs-theme");
    if (currentTheme == "dark") {
        htmlElement.setAttribute("data-bs-theme", "light");
        document.getElementById('navbar').style.backgroundColor = "#CBC3E3";
        document.getElementById('splitter').style.backgroundColor = "#CBC3E3";
        document.querySelector('.split-container').style.backgroundColor = "#FFFFFF";
        document.querySelector('.bi-circle-half').style.color = "#000000";
        document.querySelector('.bi-x-circle').style.color = "#000000";
    } else {
        htmlElement.setAttribute("data-bs-theme", "dark");
        document.getElementById('navbar').style.backgroundColor = "#44475a";
        document.getElementById('splitter').style.backgroundColor = "#44475a";
        document.querySelector('.split-container').style.backgroundColor = "#212529";
        document.querySelector('.bi-circle-half').style.color = "#FFFFFF";
        document.querySelector('.bi-x-circle').style.color = "#FFFFFF";
    }
});
