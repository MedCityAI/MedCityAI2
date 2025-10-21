import matplotlib.pyplot as plt
import numpy as np

# Create realistic historical data for Med City publications
years = np.array([1990, 1995, 2000, 2005, 2010, 2015, 2020, 2021, 2022, 2023, 2024, 2025])
publications = np.array([850, 1200, 1680, 2450, 3920, 6200, 8400, 9100, 9800, 10200, 10500, 10600])

# Create the figure with transparent background
fig, ax = plt.subplots(figsize=(10, 6))
fig.patch.set_facecolor('none')
ax.set_facecolor('none')

# Create vertical bar chart with white bars
bars = ax.bar(years, publications, width=2, color='white', alpha=0.8, 
              edgecolor='white', linewidth=2)

# Create exponential trend line
x_norm = years - 1990
log_pubs = np.log(publications)
coeffs = np.polyfit(x_norm, log_pubs, 1)
exp_a = np.exp(coeffs[1])
exp_b = coeffs[0]

# Generate smooth curve for trend
years_smooth = np.linspace(1990, 2025, 100)
x_smooth_norm = years_smooth - 1990
publications_smooth = exp_a * np.exp(exp_b * x_smooth_norm)

# Plot exponential trend line in white with thick line
ax.plot(years_smooth, publications_smooth, color='white', linewidth=4, 
       alpha=0.9, zorder=4)

# Add exaggerated upward arrow at the end of trend line
# Arrow position
arrow_start_x = 2022
arrow_start_y = publications_smooth[-20]  # A bit before the end
arrow_end_x = 2025
arrow_end_y = publications_smooth[-1] + 2000  # Exaggerated upward

# Draw the arrow
ax.annotate('', xy=(arrow_end_x, arrow_end_y), xytext=(arrow_start_x, arrow_start_y),
            arrowprops=dict(arrowstyle='->', color='white', lw=6, 
                          mutation_scale=30, alpha=0.9))

# Style the axes with white elements and large text
ax.set_xlabel('Year', fontsize=18, fontweight='bold', color='white')
ax.set_ylabel('Publications', fontsize=18, fontweight='bold', color='white')

# Large white tick labels
ax.tick_params(colors='white', labelsize=14, width=2, length=6)

# White grid
ax.grid(True, alpha=0.3, color='white', linestyle='-', linewidth=1)

# Format y-axis with large text
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x/1000:.0f}K' if x >= 1000 else f'{int(x)}'))

# Set axis limits with some padding
ax.set_xlim(1988, 2027)
ax.set_ylim(0, max(publications) * 1.3)  # Extra space for the arrow

# Make all spines white and thick
for spine in ax.spines.values():
    spine.set_color('white')
    spine.set_linewidth(2)

# Remove top and right spines for cleaner look
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Tight layout
plt.tight_layout()

# Save with transparent background
plt.savefig('images/med_city_publications_web.png', dpi=200, bbox_inches='tight', 
           facecolor='none', edgecolor='none', transparent=True)

# Also save an overlay version
plt.savefig('images/med_city_publications_overlay.png', dpi=200, bbox_inches='tight', 
           facecolor='none', edgecolor='none', transparent=True)

print("✅ Vertical bar chart with exponential arrow created!")
print("📁 Files saved:")
print("   • med_city_publications_web.png (transparent background)")
print("   • med_city_publications_overlay.png (same file)")
print("📊 Features: White bars, large text, upward arrow trend")

plt.show()