import requests
from bs4 import BeautifulSoup
import pandas as pd
import time

# Change the number at the end for different category of chemicals. Go to the chemicalbook website to learn more
BASE_URL = "https://www.chemicalbook.com/ProductCatalog_EN/24"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}
PROGRESS_FILE = "progress.log"
DATA_FILE = "scraped_data.csv"

# Save progress so as not to start over if timed out. Delete log file if the base url is changed.
def save_progress(page_number, filename=PROGRESS_FILE):
    with open(filename, "w") as f:
        f.write(str(page_number))

def load_progress(filename=PROGRESS_FILE):
    try:
        with open(filename, "r") as f:
            return int(f.read().strip())
    except FileNotFoundError:
        return 1

# Save to csv file
def save_to_csv(data, filename=DATA_FILE):
    df = pd.DataFrame(data, columns=["Chemical Name"])
    df.to_csv(filename, mode='a', header=not pd.io.common.file_exists(filename), index=False)


def scrape_page(page_number):
    # Paginated web page
    url = f"{BASE_URL}.htm" if page_number == 1 else f"{BASE_URL}-{page_number}.htm"
    print(f"Scraping: {url}")

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # Data is in a table with selector "tbody"
        table = soup.find("tbody")
        if not table:
            return None

        # Start at row 2. THe chemical name is on column 2
        rows = table.find_all("tr")[1:]
        data = [row.find_all("td")[1].get_text(strip=True) for row in rows]
        return data

    except requests.exceptions.RequestException as e:
        print(f"Error on page {page_number}: {e}")
        return None

def main():
    start_page = load_progress()
    page = start_page
    while True:
        data = scrape_page(page)
        if data:
            save_to_csv(data)
            save_progress(page)
            page += 1
            time.sleep(2)  # Pause between requests
        else:
            print(f"No data or error on page {page}. Stopping.")
            break

if __name__ == "__main__":
    main()
