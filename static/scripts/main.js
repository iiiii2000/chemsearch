document.addEventListener("DOMContentLoaded", function() {
    const searchForm = document.getElementById("search-form");
    const searchBar = document.getElementById("search-bar");
    const suggestionsBox = document.getElementById("suggestions");
    const loadingOverlay = document.getElementById("loading-overlay");
    const resultsContainer = document.getElementById("search-results-container");
    const initial_results = document.createElement("div");
    const similar_results = document.createElement("div");
    const rightpanel = document.querySelector(".panel-right");
    const navbar = document.querySelector(".navbar");
    const leftpanel = document.querySelector(".panel-left");

    // Fetch suggestions as the user types
    let currentIndex = -1; // Keeps track of the current highlighted suggestion
    ['input', 'focus'].forEach(event => searchBar.addEventListener(event, async () => {
        const query = searchBar.value;
        // Clear suggestions if input is less than 2 characters (chemicals naem often contain >=2 characters)
        if (query.length < 2) {
            suggestionsBox.innerHTML = '';
            suggestionsBox.style.display = 'none';
            currentIndex = -1;
            return;
        }

        // Fetch suggestions from the server
        const response = await fetch(`/search?q=${query}`);
        const suggestions = await response.json();

        // Update the suggestions box
        suggestionsBox.innerHTML = '';
        if (suggestions.length > 0) {
            suggestionsBox.style.display = 'block'; // Show the suggestion box
            suggestions.forEach((name, index) => {
                const li = document.createElement('li');
                li.textContent = name;
                li.classList.add('list-group-item');
                li.dataset.index = index;

                // Set currentIndex on hover
                li.addEventListener('mouseenter', () => {
                    currentIndex = index; // Update currentIndex to the hovered item
                    updateHighlightedItem(suggestionsBox.querySelectorAll('li')); // Update highlighting
                });

                li.onclick = () => {
                    suggestionsBox.innerHTML = '';
                    suggestionsBox.style.display = 'none';
                    currentIndex = -1;
                };

                suggestionsBox.appendChild(li);
            });

        } else {
            suggestionsBox.style.display = 'none';
        }
    }));

    // Handle keyboard navigation
    searchBar.addEventListener('keydown', (event) => {
        const suggestions = suggestionsBox.querySelectorAll('li');
        const totalSuggestions = suggestions.length;

        // Prevent the default behavior of arrow keys
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); // Prevent the cursor from moving
        }

        if (event.key === 'ArrowDown') {
            // Move down to the next suggestion
            if (currentIndex < totalSuggestions - 1) {
                currentIndex++;
                updateHighlightedItem(suggestions);
                scrollToHighlightedItem(suggestions[currentIndex]);
            }
        } else if (event.key === 'ArrowUp') {
            // Move up to the previous suggestion
            if (currentIndex > 0) {
                currentIndex--;
                updateHighlightedItem(suggestions);
                scrollToHighlightedItem(suggestions[currentIndex]);
            }
        } else if (event.key === 'Enter') {
            // Select the current highlighted suggestion
            if (currentIndex >= 0 && currentIndex < totalSuggestions) {
                searchBar.value = suggestions[currentIndex].textContent;
                suggestionsBox.innerHTML = '';
                suggestionsBox.style.display = 'none';
                currentIndex = -1;
            }
        }
    });

    // Update the highlighted item
    function updateHighlightedItem(suggestions) {
        suggestions.forEach(item => item.classList.remove('highlighted')); // Remove highlight from all items
        if (currentIndex >= 0 && currentIndex < suggestions.length) {
            suggestions[currentIndex].classList.add('highlighted'); // Add highlight to the current item
        }
    }

    // Ensure the highlighted item is visible in the suggestion box
    function scrollToHighlightedItem(item) {
        if (!item) return;

        const itemRect = item.getBoundingClientRect();
        const boxRect = suggestionsBox.getBoundingClientRect();

        // If the item is near the top, scroll up
        if (itemRect.top < boxRect.top) {
            suggestionsBox.scrollTop -= (boxRect.top - itemRect.top);
        }
        // If the item is near the bottom, scroll down
        else if (itemRect.bottom > boxRect.bottom) {
            suggestionsBox.scrollTop += (itemRect.bottom - boxRect.bottom);
        }
    }

    // Function to show/hide the suggestion list
    function toggleSuggestions(show) {
        if (show) {
            suggestionsBox.style.display = 'block';
        } else {
            suggestionsBox.style.display = 'none';
        }
    }

    // Event listener for clicking outside the search bar and suggestion list
    document.addEventListener('click', function(event) {
        if (!searchBar.contains(event.target) && !suggestionsBox.contains(event.target)) {
            toggleSuggestions(false); // Hide the suggestion list if clicked outside
        }
    });

    // Loading screen
    function toggleLoading(visible) {
        loadingOverlay.style.setProperty("display", visible ? "flex" : "none", "important");
    }

    // Create cards to present the results
    function createCard(data) {
        const cardDiv = document.createElement("div");
        cardDiv.classList.add("col-sm-6", "col-md-4", "col-lg-4", "mb-3");
        cardDiv.innerHTML = `
            <div class="card h-100 d-flex flex-column">
                <div class="card-body d-flex flex-column">
                    <h6 class="card-title">${data.Title}</h6>
                    <p class="card-text">Formula: ${data.MolecularFormula.replace(/(\d+)/g, "<sub>$1</sub>")}</p>
                    <form class="mt-auto" method="GET" action="/chemical">
                        <button class="btn btn-primary" type="submit" value="${data.CID}" name="cid">View Detail</button>
                    </form>
                </div>
            </div>
        `;
        return cardDiv;
    }

    // Add the created cards to the left panel
    function appendResultsToContainer(data, container) {
        const rowDiv = container.querySelector(".row") || document.createElement("div");
        if (!rowDiv.classList.contains("row")) {
            rowDiv.classList.add("row", "gx-3", "justify-content-md-center");
            container.appendChild(rowDiv);
        }

        data.forEach(item => {
            const card = createCard(item);
            rowDiv.appendChild(card);
        });
    }

    function renderResults(data, container) {
        toggleLoading(false);
        if (data.error) {
            container.innerHTML = `<p>${data.error}</p>`;
        } else {
            appendResultsToContainer(data, container);
        }
    }

    // Handle SSE for similar results
    let currentEventSource = null;

    function startStreamingResults(query, spinner) {
        if (currentEventSource) {
            currentEventSource.close();
        }

        currentEventSource = new EventSource(`/fetch?q=${encodeURIComponent(query)}`);
        let hasResults = false;

        // Set a timeout for the EventSource connection
        const timeout = setTimeout(() => {
            console.log("Timeout reached. Closing EventSource.");
            currentEventSource.close();
            spinner.style.display = "none"; // Hide the spinner
            if (!hasResults) {
                similar_results.style.display = "none"; // Hide similar results section if no results received
            }
        }, 20000); // Set timeout to 20 seconds (adjust as needed)

        currentEventSource.onmessage = function(event) {
            clearTimeout(timeout); // Clear the timeout if a message is received
            toggleLoading(false);
            const data = JSON.parse(event.data);

            if (data.error) {
                currentEventSource.close();
                return;
            }

            hasResults = true;
            similar_results.style.display = "block";
            appendResultsToContainer([data], similar_results);
        };

        currentEventSource.onerror = function() {
            clearTimeout(timeout); // Clear the timeout on error
            toggleLoading(false);
            currentEventSource.close();
            spinner.style.display = "none";
            if (!hasResults) {
                similar_results.style.display = "none";
            }
        };

        currentEventSource.onclose = function() {
            clearTimeout(timeout); // Clear the timeout on close
            spinner.style.display = "none";
            if (!hasResults) {
                similar_results.style.display = "none";
            }
        };
    }

    // Handle fetching results (initial results via fetch, and similar results via SSE)
    function fetchResults(query) {
        searchBar.value = '';
        rightpanel.innerHTML = `
            <div id='right-initial' style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                    <h4 style="margin-bottom:1.5rem">Nothing to display yet.</h4>
                    <img src="/static/favicon/android-chrome-192x192.png" style="width: 50%;">
            </div>
        `;
        toggleLoading(true);

        resultsContainer.innerHTML = "";
        fetch("/search", {
                method: "POST",
                body: new URLSearchParams({
                    "user-input": query
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    resultsContainer.innerHTML = `<p>${data.error}</p>`;
                    toggleLoading(false);
                    return;
                }

                suggestionsBox.innerHTML = "";
                suggestionsBox.style.display = "none";

                initial_results.innerHTML = "";
                similar_results.innerHTML = "";
                similar_results.style.display = "none";

                const first_line = document.createElement("div");
                first_line.innerHTML = `<h4>Found ${data.length} result${data.length === 1 ? "" : "s"}</h4>`;
                first_line.style.marginBottom = "1.5rem";
                initial_results.append(first_line);
                resultsContainer.appendChild(initial_results);
                renderResults(data, initial_results);


                return query;
            })
            .then(query => {
                if (!query) return;

                const second_line = document.createElement("div");
                second_line.innerHTML = `<h4>You may also want to see: </h4>`;
                second_line.style.marginBottom = "1.5rem";
                second_line.style.marginTop = "1.5rem";

                const spinner = document.createElement("div");
                spinner.classList.add("spinner-border", "spinner-border-sm", "text-primary");
                spinner.setAttribute("role", "status");
                const spinnerSpan = document.createElement("span");
                spinnerSpan.classList.add("sr-only");
                spinner.appendChild(spinnerSpan);

                second_line.style.display = "flex";
                second_line.style.alignItems = "center";
                second_line.style.gap = "10px";
                second_line.appendChild(spinner);

                similar_results.append(second_line);
                resultsContainer.appendChild(similar_results);

                startStreamingResults(query, spinner);
            })
            .catch(error => {
                console.error("Error during fetch:", error);
                toggleLoading(false);
                resultsContainer.innerHTML = "<p>Error fetching results. Try again later.</p>";
            });
    }

    // Check if the screen is mobile
    const breakpoint = 768; // Match the breakpoint in your CSS media query
    function isMobile() {
        return window.innerWidth <= breakpoint;
    }

    // Render the detail on the right panel/popout
    function renderChemicalDetails(data) {
        rightpanel.innerHTML = '';
        rightpanel.classList.add('active');
        rightpanel.innerHTML = `
            <div id="chemical-detail">
                <h3 style="text-align: center; margin-bottom: 1.5rem; margin-top: 1.2rem;">${data.Title}</h3>
                <img src="${data.image}", style="display: block; margin-left: auto; margin-right: auto; margin-bottom: 2rem; width: 80%;">
                <table style="width: 100%; margin: 0px auto;">
                    <tbody>
                        <tr>
                            <td class="fitwidth">Molecular Formula</td>
                            <td>${data.MolecularFormula.replace(/(\d+)/g, "<sub>$1</sub>")}</td>
                        </tr>
                        <tr>
                            <td class="fitwidth">IUPAC name</td>
                            <td>${data.IUPACName}</td>
                        </tr>
                        <tr>
                            <td class="fitwidth">Molecular Weight</td>
                            <td>${data.MolecularWeight} g/mol</td>
                        </tr>
                        <tr>
                            <td class="fitwidth">Number of stereo centers</td>
                            <td>${data.AtomStereoCount}</td>
                        </tr>
                        <tr>
                            <td class="fitwidth">Number of stereo bonds</td>
                            <td>${data.BondStereoCount}</td>
                        </tr>
                        <tr>
                            <td class="fitwidth">Source</td>
                            <td>
                                <a href='${data.pubchem}' target="_blank">PubChem</a>,
                                <a href='${data.cas}' target="_blank"> CAS</a>,
                                <a href='${data.chemspider}' target="_blank"> ChemSpider</a>
                            </td>
                        </tr>
                    <tbody>
                </table>
            </div>
            `;
        const closeButton = document.createElement('button'); // Create the close button
        const currentTheme = htmlElement.getAttribute("data-bs-theme");
        let button_color = '#FFFFFF'
        if (currentTheme == 'light') {
            button_color = '#000000';
        }
        // Configure the close button
        closeButton.innerHTML = `<i class="bi bi-x-circle" style="color: ${button_color}"></i>`;
        closeButton.classList.add('close-btn');
        rightpanel.appendChild(closeButton); // Add the button to the panel

        // Close button listener
        closeButton.addEventListener('click', function () {
            rightpanel.classList.remove('active');
            leftpanel.classList.remove('blurred');
            navbar.classList.remove('blurred');
        });

        // Blur everything else if popout
        if (isMobile()) {
            leftpanel.classList.add('blurred');
            navbar.classList.add('blurred');
        }

        toggleLoading(false);
    }

    // When to fetch results
    searchForm.addEventListener("submit", function(event) {
        event.preventDefault();
        const searchQuery = searchBar.value.trim();
        if (searchQuery) fetchResults(searchQuery);
    });

    suggestionsBox.addEventListener("click", function(event) {
        const clickedItem = event.target;
        if (clickedItem.tagName === "LI") {
            searchBar.value = clickedItem.textContent;
            fetchResults(clickedItem.textContent.trim());
        }
    });

    resultsContainer.addEventListener("submit", function(event) {
        event.preventDefault(); // Prevent default form submission
        toggleLoading(true);
        if (event.target.tagName === "FORM") {
            const form = event.target;

            // Locate the button inside the form and extract the "value" attribute
            const button = form.querySelector("button[name='cid']");
            if (button) {
                const cid = button.value; // Extract the cid value
                console.log("Extracted CID:", cid);

                // Replace form submission with a fetch request
                fetch(`/chemical?cid=${encodeURIComponent(cid)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            rightpanel.innerHTML = `<p>${data.error}</p>`;
                            toggleLoading(false);
                            return;
                        }
                        console.log("Fetched details for CID:", cid);
                        renderChemicalDetails(data); // Handle the fetched data
                    })
                    .catch(error => {
                        console.error("Error fetching details:", error);
                        toggleLoading(false);
                    });
            }
        }
    });

});