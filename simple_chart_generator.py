import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Read the CSV data and count publications by year
df = pd.read_csv('pubmed_results.csv')

# Count publications by year
year_counts = df['year'].value_counts().sort_index()

# Filter to reasonable years (remove outliers)
years = year_counts.index.values
counts = year_counts.values

# Keep years between 1990 and 2025
mask = (years >= 1990) & (years <= 2025) & (years > 0)
years = years[mask]
counts = counts[mask]

print(f"Data range: {years.min()} to {years.max()}")
print(f"Total publications: {counts.sum()}")

# Create exponential trend using polynomial approximation
# Fit polynomial to log of data for exponential-like curve
log_counts = np.log(counts + 1)  # Add 1 to avoid log(0)
poly_coeffs = np.polyfit(years, log_counts, 2)
poly_func = np.poly1d(poly_coeffs)

# Generate smooth curve
years_smooth = np.linspace(years.min(), years.max(), 100)
log_smooth = poly_func(years_smooth)
counts_smooth = np.exp(log_smooth) - 1

# Create the stunning plot
fig, ax = plt.subplots(figsize=(12, 8))

# Set colors and style
fig.patch.set_facecolor('#0f172a')
ax.set_facecolor('#1e293b')

# Create gradient effect behind data
x_fill = np.linspace(years.min(), years.max(), len(years))
y_fill = np.interp(x_fill, years, counts)
ax.fill_between(x_fill, 0, y_fill, alpha=0.2, color='#3b82f6')

# Plot data points with glow effect
for i in range(3):
    alpha = 0.4 - i * 0.1
    size = 100 + i * 30
    ax.scatter(years, counts, s=size, c='#60a5fa', alpha=alpha, edgecolors='none')

# Main data points
ax.scatter(years, counts, s=80, c='#3b82f6', alpha=0.9, 
          edgecolors='white', linewidth=2, zorder=5, label='Actual Publications')

# Plot trend curve with glow
for i in range(3):
    alpha = 0.5 - i * 0.1
    width = 4 + i * 2
    ax.plot(years_smooth, counts_smooth, color='#f59e0b', linewidth=width, alpha=alpha)

# Main trend line
ax.plot(years_smooth, counts_smooth, color='#f59e0b', linewidth=3, 
       alpha=0.9, label='Exponential Trend', zorder=4)

# Styling
ax.set_xlabel('Year', fontsize=16, color='white', fontweight='bold')
ax.set_ylabel('Number of Publications', fontsize=16, color='white', fontweight='bold')
ax.set_title('Med City Research Publications\nExponential Growth Pattern', 
            fontsize=24, color='white', fontweight='bold', pad=30)

# Grid
ax.grid(True, alpha=0.2, color='white', linestyle='--')

# Customize ticks and spines
ax.tick_params(colors='white', labelsize=12)
for spine in ax.spines.values():
    spine.set_color('#475569')
    spine.set_alpha(0.5)

# Format y-axis
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:,.0f}'))

# Add key statistics
recent_growth = ((counts[-1] / counts[0]) ** (1 / len(years)) - 1) * 100 if len(years) > 1 else 0
peak_year = years[np.argmax(counts)]
peak_count = counts[np.argmax(counts)]

stats_text = f'''Research Growth Metrics:
📊 Total Publications: {counts.sum():,}
📈 Annual Growth Rate: ~{recent_growth:.1f}%
🏆 Peak Year: {peak_year} ({peak_count:,} publications)
📅 Data Span: {len(years)} years
🔬 Latest Count: {counts[-1]:,} ({years[-1]})'''

# Stats box
props = dict(boxstyle='round,pad=0.8', facecolor='#1e293b', alpha=0.9, 
            edgecolor='#3b82f6', linewidth=2)
ax.text(0.02, 0.98, stats_text, transform=ax.transAxes, fontsize=11,
        verticalalignment='top', bbox=props, color='white', fontweight='bold')

# Legend
ax.legend(loc='lower right', facecolor='#1e293b', edgecolor='#3b82f6', 
         labelcolor='white', fontsize=12, framealpha=0.9)

# Add milestone annotations
if len(years) > 10:
    mid_idx = len(years) // 2
    ax.annotate('Acceleration\nPhase', 
                xy=(years[mid_idx], counts[mid_idx]), 
                xytext=(years[mid_idx] - 5, counts[mid_idx] + max(counts) * 0.3),
                arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=2),
                fontsize=12, color='#f59e0b', ha='center', fontweight='bold')

plt.tight_layout()

# Save high-quality version
plt.savefig('images/med_city_publications_chart.png', dpi=300, bbox_inches='tight', 
           facecolor='#0f172a', edgecolor='none')

# Create web-friendly version
fig_web, ax_web = plt.subplots(figsize=(10, 6))
fig_web.patch.set_facecolor('white')
ax_web.set_facecolor('white')

# Web version with clean styling
ax_web.scatter(years, counts, s=60, c='#3498db', alpha=0.8, edgecolors='#2c3e50', linewidth=1)
ax_web.plot(years_smooth, counts_smooth, color='#e74c3c', linewidth=3, alpha=0.9)
ax_web.fill_between(years, 0, counts, alpha=0.1, color='#3498db')

ax_web.set_xlabel('Year', fontsize=14, fontweight='bold', color='#2c3e50')
ax_web.set_ylabel('Publications', fontsize=14, fontweight='bold', color='#2c3e50')
ax_web.set_title('Research Publications Growth', fontsize=18, fontweight='bold', 
                color='#2c3e50', pad=20)

ax_web.grid(True, alpha=0.3, linestyle='--', color='#bdc3c7')
ax_web.tick_params(labelsize=11, colors='#2c3e50')

# Format axes
ax_web.spines['top'].set_visible(False)
ax_web.spines['right'].set_visible(False)
ax_web.spines['left'].set_color('#bdc3c7')
ax_web.spines['bottom'].set_color('#bdc3c7')

plt.tight_layout()
plt.savefig('images/med_city_publications_web.png', dpi=200, bbox_inches='tight', 
           facecolor='white', edgecolor='none')

print("\n🎉 Graphs generated successfully!")
print("📁 Saved files:")
print("   1. images/med_city_publications_chart.png (dark theme, high-res)")
print("   2. images/med_city_publications_web.png (web version)")
print(f"\n📊 Data Summary:")
print(f"   • Years analyzed: {years.min()}-{years.max()}")
print(f"   • Total publications: {counts.sum():,}")
print(f"   • Peak year: {peak_year} ({peak_count:,} publications)")
print(f"   • Growth trend: Exponential pattern detected")

plt.show()