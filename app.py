import requests
import json
import difflib
import collections
from cs50 import SQL
from flask import Flask, flash, redirect, render_template, request, jsonify, Response, session
from flask_session import Session

# Configure application
app = Flask(__name__)

# Configure session to use filesystem (instead of signed cookies)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
Session(app)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///chemicals.db")

# Function to count the total number of atoms given a formula


def count_of_atoms(formula):
    stack = [collections.Counter()]
    i = 0

    while i < len(formula):
        if formula[i] == '(':
            stack.append(collections.Counter())
            i += 1
        elif formula[i] == ')':
            top = stack.pop()
            i += 1
            start = i
            while i < len(formula) and formula[i].isdigit():
                i += 1
            multiplier = int(formula[start:i] or 1)
            for name, v in top.items():
                stack[-1][name] += v * multiplier
        else:
            start = i
            i += 1
            while i < len(formula) and formula[i].islower():
                i += 1
            name = formula[start:i]
            start = i
            while i < len(formula) and formula[i].isdigit():
                i += 1
            count = int(formula[start:i] or 1)
            stack[-1][name] += count

    return sum(stack[-1].values())  # Total atom count

# Searching


@app.route('/search', methods=['GET', 'POST'])
def search():
    if request.method == "POST":
        # Handle Greek characters
        replacements = str.maketrans({"Α": "alpha", 'α': "alpha", "B": "beta", "β": "beta", "Γ": "gamma", "γ": "gamma", "Δ": "delta", "δ": "delta", "Ε": "epsilon", "ε": "epsilon", "Ζ": "zeta", "ζ": "zeta", "Η": "eta", "η": "eta", "Θ": "theta", "θ": "theta", "Ι": "iota", "ι": "iota", "Κ": "kappa", "κ": "kappa", "Λ": "lambda", "λ": "lambda", "Μ": "mu",
                                     "μ": "mu", "Ν": "nu", "ν": "nu", "Ξ": "xi", "ξ": "xi", "Ο": "omicron", "ο": "omicron", "Π": "pi", "π": "pi", "Ρ": "rho", "ρ": "rho", "Σ": "sigma", "σ": "sigma", "ς": "sigma", "Τ": "tau", "τ": "tau", "Υ": "upsilon", "υ": "upsilon", "Φ": "phi", "φ": "phi", "Χ": "chi", "χ": "chi", "Ψ": "psi", "ψ": "psi", "Ω": "omega", "ω": "omega"})
        name = request.form.get('user-input', '').strip().translate(replacements)
        if not name:
            flash("No chemical name provided", "danger")
            return redirect("/")

        # Perform search operation
        try:
            # Get the most relevant result
            cids = []
            cids.extend(requests.get("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" +
                        name + "/cids/TXT").text.strip('\n').split())
            if cids[0] == 'Status:':
                cids.clear()
                # Try convert to molecular formula, then search again
                formula = name.replace(' ', '').upper()
                formula_request = requests.get(
                    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/" + formula + "/cids/TXT?MaxRecords=10").text.strip('\n').split()
                if "Status" in formula_request[0]:
                    return jsonify({'error': 'Error when searching. Try again with another name or come back later.'})
                else:
                    cids.extend(formula_request[:5])

            url_cids = ''
            for cid in cids:
                url_cids = url_cids + cid + ','
            compounds_request = requests.get("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" +
                                             url_cids + "/property/Title,MolecularFormula,Complexity,IsotopeAtomCount,SMILES/json")
            compounds = compounds_request.json()["PropertyTable"]["Properties"]

            # Priotise compounds without isotope atoms and with smaller complexity score
            compounds = sorted(compounds, key=lambda d: (d['IsotopeAtomCount'], d['Complexity']))

            # Populate the chemicals database if not already exist
            db.execute("INSERT OR IGNORE INTO chemicals (name) VALUES (LOWER(TRIM(?)))", name)
        except:
            return jsonify({'error': 'Error when searching. Try again with another name or come back later.'})

        session['cids'] = cids
        session['compounds'] = compounds
        return jsonify(compounds)

    # For GET request (suggestions):
    elif request.method == "GET":
        query = request.args.get('q', '').lower()
        if not query:
            return jsonify([])

        suggest_list = db.execute("""
            SELECT name
            FROM chemicals
            WHERE name LIKE ?
            ORDER BY LENGTH(name) ASC
            LIMIT 10
        """, f"%{query}%")

        suggestions = [row['name'] for row in suggest_list]
        return jsonify(suggestions)

# Suggestions


@app.route('/fetch', methods=['GET'])
def fetch():
    name = request.args.get('q', '').strip()
    if not name:
        return Response("data: {\"error\": \"No chemical name provided.\"}\n\n", content_type="text/event-stream")

    cids = session.get('cids', [])
    compounds = session.get('compounds', [])
    formula = compounds[0]['MolecularFormula']
    smiles = compounds[0]['SMILES']

    def generate():
        try:
            fuzzy_list = []
            # Search for similar results (base on molecular formula), limit to 50 max
            fuzzy_list.extend(requests.get(
                f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/{formula}/cids/TXT?MaxRecords=50").text.strip().split()[:50])
            # Search for similar results (base on name), limit to 50 max
            fuzzy_list.extend(requests.get(
                f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/cids/TXT?name_type=word").text.strip().split()[:100])
            fuzzy_list.extend(requests.get(
                f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastsimilarity_2d/smiles/{smiles}/cids/TXT?Threshold=50&MaxRecords=100").text.strip().split()[:50])

            # Append new CIDs
            for i in fuzzy_list:
                if (i not in cids) and i.isnumeric():
                    cids.append(i)

            # Fetch properties for each CID
            suggested_cids = cids[len(compounds):]

            # Split into smaller list of 50 items each
            split_cid = [suggested_cids[i:i + 50] for i in range(0, len(suggested_cids), 50)]

            # Retrive compound properties
            suggested_compounds_request = []
            for split_list in split_cid:
                url_cid = ''
                for cid in split_list:
                    url_cid = url_cid + cid + ','
                suggested_compounds_request.extend(requests.get("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" +
                                                                url_cid + "/property/Title,MolecularFormula,Complexity,IsotopeAtomCount,IUPACName/json").json()["PropertyTable"]["Properties"])
            # Get the similarity of name, similarity of formula, and atom count
            for item in suggested_compounds_request:
                item['NameSimilarity'] = - (difflib.SequenceMatcher(None,
                                            item['Title'], compounds[0]['Title'], autojunk=True).ratio())
                item['FormulaSimilarity'] = - \
                    (difflib.SequenceMatcher(None, item['MolecularFormula'], formula).ratio())
                item['AtomCount'] = count_of_atoms(item['MolecularFormula'])

            # Sort list
            suggested_compounds_request = sorted(
                suggested_compounds_request, key=lambda d: (d['FormulaSimilarity'], d['AtomCount'], d['NameSimilarity'], d['Complexity']))

            # Filter out meaningless compounds, some salts, etc. Only show isotopes if initial result contain isotope atoms.
            for item in suggested_compounds_request:
                if 'CID' not in item['Title']:
                    if 'IUPACName' in item:
                        if ';' not in item['IUPACName']:
                            if item['AtomCount'] < count_of_atoms(formula) * 2:
                                if compounds[0]['IsotopeAtomCount'] != 0:
                                    yield f"data: {json.dumps(item)}\n\n"
                                else:
                                    if item['IsotopeAtomCount'] == 0:
                                        yield f"data: {json.dumps(item)}\n\n"
        except Exception as e:
            yield f"data: {{\"error\": \"Error: {str(e)}\"}}\n\n"

    return Response(generate(), content_type="text/event-stream")

# Details


@app.route('/chemical', methods=['GET'])
def chemical():
    cid = request.args.get('cid', '').strip()

    try:
        # Get the general properties: molecular formula and weight, IUPAC name, title,...
        compound = requests.get("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + cid +
                                "/property/Title,MolecularFormula,MolecularWeight,IUPACName,AtomStereoCount,BondStereoCount/json").json()["PropertyTable"]["Properties"][0]

        # Get image
        test_url = "https://opsin.ch.cam.ac.uk/opsin/" + compound['IUPACName'] + ".svg"
        img_response = requests.get(test_url)
        if ("+" or "-") in compound['MolecularFormula']:
            compound['image'] = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + \
                str(compound['CID']) + "/png"
        elif img_response.status_code == 200 and 'image/svg+xml' in img_response.headers.get('Content-Type', ''):
            compound['image'] = test_url
        else:
            compound['image'] = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" + \
                str(compound['CID']) + "/png"

        # Link to sources
        compound['pubchem'] = "https://pubchem.ncbi.nlm.nih.gov/compound/" + str(compound['CID'])
        compound['cas'] = "https://commonchemistry.cas.org/results?q=" + compound['Title']
        compound['chemspider'] = "https://www.google.com/search?q=site%3Achemspider.com+" + compound['Title']

        return jsonify(compound)
    except:
        return jsonify({'error': 'Error when fetching details'})

# Homepage


@app.route("/")
def homepage():
    return render_template("index.html")