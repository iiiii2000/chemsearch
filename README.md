TBD
# Scraper
This folder contains the scripts for scraping wikipedia and chemicalbook website to get the name of common chemicals. They output csv files, which are then imported into the sqlite database chemicals.db for the auto-complete searching function of the webapp.

# The main web app
TBD

This is a flask app, which can be used to search for chemicals. Searching will return the result(s) and a list of similar compounds (base on name and molecular formula). All information is retrieved using the PubChem REST-API
