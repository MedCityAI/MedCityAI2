import re
import pandas as pd
import plotly.express as px
from plotly.subplots import make_subplots

# Load file
file_path = "C:\\Users\\hanna\\OneDrive\\Documents\\MedCityAI\\query_pubmed\\pubmed_abstracts.txt"
with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

# Regex patterns for country and US states
country_pattern = r"\b[A-Z][a-z]+(?: [A-Z][a-z]+)*\b"  # naive capitalized word sequences (we'll filter later)
us_states = [
    "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
    "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana",
    "Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana",
    "Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina",
    "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
    "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
    "Wisconsin","Wyoming","District of Columbia"
]
us_state_abbr = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO",
    "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX",
    "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC"
}

# Extract all matches
matches = re.findall(country_pattern, text)

# Load list of countries from pycountry for filtering
import pycountry
country_names = [country.name for country in pycountry.countries]

# Filter for countries
countries_found = [m for m in matches if m in country_names]

# Filter for states and abbreviations, combine counts
state_combined_counts = {}
for state in us_states:
    # Count full state name
    count_name = text.count(state)
    # Count abbreviation (word boundaries)
    abbr = us_state_abbr[state]
    abbr_pattern = r"\b{}\b".format(re.escape(abbr))
    count_abbr = len(re.findall(abbr_pattern, text))
    # Combine counts for state name and abbreviation
    total_count = count_name + count_abbr
    state_combined_counts[state] = total_count
#
# Build frequency tables
country_counts = pd.Series(countries_found).value_counts().reset_index()
country_counts.columns = ["Country", "Count"]

state_counts = pd.Series(state_combined_counts).reset_index()
state_counts.columns = ["US State", "Count"]

print(country_counts.head(50)) 
print(state_counts.head(50))

state_counts["State Code"] = state_counts["US State"].map(us_state_abbr)
second_highest = state_counts["Count"].nlargest(2).iloc[-1]
min_val = state_counts["Count"].min()

fig1 = px.choropleth(
    state_counts,
    locations="State Code",
    locationmode='USA-states',
    color="Count",
    color_continuous_scale="RdPu",
    scope="usa",
    range_color=[min_val, second_highest]
)

fig1.update_layout(
    title_text="Co-author Affiliations By State",
    title_x=0.5,
    margin=dict(l=0, r=0, t=50, b=0),
    geo=dict(
        fitbounds="locations",  # tightly fit to your data
        projection_scale=1
    ),
    coloraxis_colorbar=dict(
        orientation="h",
        y=-0.1,
        x=0.5,
        xanchor="center",
        yanchor="top"
    )
)
#fig1.show()
fig1.write_html("state_map.html", include_plotlyjs="cdn")

second_highest2 = country_counts["Count"].nlargest(2).iloc[-1]
min_val2 = country_counts["Count"].min()

fig2 = px.choropleth(
    country_counts,
    locations="Country",
    locationmode="country names",
    color="Count",
    color_continuous_scale="RdPu",
    range_color=[min_val2, second_highest2]
)


fig2.update_layout(
    title_text="Co-author Affiliations By Country",
    title_x=0.5,
    margin=dict(l=0, r=0, t=50, b=0),
    geo=dict(
        fitbounds="locations",  # tightly fit to your data
        projection_scale=1
    ),
    coloraxis_colorbar=dict(
        orientation="h",
        y=-0.1,
        x=0.5,
        xanchor="center",
        yanchor="top"
    )
)

fig2.show()

fig2.write_html("world_map.html", include_plotlyjs="cdn")
