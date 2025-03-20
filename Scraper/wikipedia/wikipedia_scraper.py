import requests
from bs4 import BeautifulSoup
import csv
import re

# URL of the Wikipedia page
url = "https://en.wikipedia.org/wiki/Glossary_of_chemical_formulae"

# Fetch the webpage content
response = requests.get(url)
soup = BeautifulSoup(response.content, "html.parser")

# Find all the tables (assuming they are structured correctly with <table> tags)
tables = soup.find_all('table', {'class': 'wikitable'})

# List to store the chemical names
chemical_names = []

# Regular expression to match names like " A-B-C" where A, B, and C are numbers (with or without leading space)
pattern = re.compile(r'^\s*\d+(-\d+)+$')

# Iterate over each table (for each letter group)
for table in tables:
    # Find all rows in the table (skip the first row which is the header)
    rows = table.find_all('tr')[1:]

    for row in rows:
        # Find all the columns in the row
        columns = row.find_all('td')

        # Skip rows that don't have at least 2 columns
        if len(columns) < 2:
            continue
        
        # Get the chemical names from the second column (which might have multiple names or links)
        name_cell = columns[1]
        
        # Check if the cell contains <br> tags (multiple names)
        if name_cell.find_all('br'):
            # Extract the names separated by <br> tags
            names = [line.strip() for line in name_cell.decode_contents().split('<br/>') if line.strip()]

            # If the first name is in an <a> tag, extract it separately
            a_tag = name_cell.find('a')
            if a_tag:
                linked_name = a_tag.get_text(strip=True)
                # Replace the first name in the list with the linked name
                names[0] = linked_name
            
            # Add all names to the list (avoid duplication)
            for name in names:
                if name and name not in chemical_names and name != " ":
                    # Check if the name matches the "A-B-C" pattern with or without leading space and skip it if it does
                    if not pattern.match(name):
                        chemical_names.append(name)
        else:
            # If no <br> tags, handle the name normally (linked or plain)
            a_tags = name_cell.find_all('a')
            linked_names = [a.get_text(strip=True) for a in a_tags]

            # Get the remaining text after the <a> tags (e.g., "ion" in your example)
            remaining_text = name_cell.get_text(" ", strip=True)

            # Combine the linked names and the remaining text (avoid duplication)
            full_name = " ".join(linked_names) + " " + remaining_text.replace(" ".join(linked_names), "").strip()

            # Add the full name to the list of chemical names
            if full_name and full_name != " " and not pattern.match(full_name):
                chemical_names.append(full_name)

# Now, write the list of chemical names to a CSV file
csv_filename = 'chemical_names.csv'

with open(csv_filename, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    # Write the header row
    writer.writerow(['Chemical Name'])
    # Write the chemical names to the file
    for name in chemical_names:
        writer.writerow([name])

print(f"Chemical names have been written to {csv_filename}")
