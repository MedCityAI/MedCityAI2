import matplotlib.pyplot as plt
from wordcloud import WordCloud

# --- Add your paper titles/abstracts/keywords here ---
file_path = "C:\\Users\\hanna\\OneDrive\\Documents\\MedCityAI\\query_pubmed\\pubmed_abstracts.txt"
with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()


# Generate the word cloud
wordcloud = WordCloud(
    width=1000,
    height=600,
    background_color="Black",
    colormap="Blues",
    collocations=False
).generate(text)

# Display the word cloud
plt.figure(figsize=(12, 7))
plt.imshow(wordcloud, interpolation="bilinear")
plt.axis("off")
plt.tight_layout()
plt.show()

# Optionally save to file
wordcloud.to_file("wordcloud_papers.png")
print("✅ Word cloud saved as wordcloud_papers.png")