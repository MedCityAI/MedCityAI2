import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from scipy.optimize import curve_fit
import seaborn as sns

# Set style for a professional look
plt.style.use('default')
sns.set_palette("husl")

# Read the CSV data
data = """Year,Count
2024,10293
2023,9671
2022,9824
2021,10478
2020,9723
2019,8214
2018,7780
2017,7535
2016,7255
2015,6351
2014,5329
2013,3760
2012,3143
2011,3109
2010,2854
2009,2631
2008,2703
2007,2544
2006,2388
2005,2226
2004,1993
2003,1971
2002,1867
2001,1760
2000,1677
1999,1523
1998,1507
1997,1425
1996,1316
1995,1386
1994,1317
1993,1276
1992,1170
1991,1065
1990,1173"""

# Create DataFrame
from io import StringIO
df = pd.read_csv(StringIO(data))

# Sort by year for proper plotting
df = df.sort_values('Year')

# Define exponential function
def exponential_func(x, a, b, c):
    return a * np.exp(b * (x - 1990)) + c

# Fit exponential curve
x_data = df['Year'].values
y_data = df['Count'].values

# Initial guess for parameters
initial_guess = [1000, 0.05, 1000]

try:
    popt, pcov = curve_fit(exponential_func, x_data, y_data, p0=initial_guess, maxfev=5000)
    print(f"Fitted parameters: a={popt[0]:.2f}, b={popt[1]:.4f}, c={popt[2]:.2f}")
except:
    # Fallback to simpler exponential if complex fitting fails
    def simple_exp(x, a, b):
        return a * np.exp(b * (x - 1990))
    popt, pcov = curve_fit(simple_exp, x_data, y_data, maxfev=5000)
    exponential_func = simple_exp

# Create the plot
fig, ax = plt.subplots(1, 1, figsize=(12, 8))

# Set background color
fig.patch.set_facecolor('#f8f9fa')
ax.set_facecolor('#ffffff')

# Plot actual data points
scatter = ax.scatter(df['Year'], df['Count'], 
                    c=df['Count'], 
                    cmap='viridis', 
                    s=80, 
                    alpha=0.8, 
                    edgecolors='white', 
                    linewidth=2,
                    zorder=5)

# Create smooth curve for exponential fit
x_smooth = np.linspace(1990, 2024, 100)
y_smooth = exponential_func(x_smooth, *popt)

# Plot exponential curve
ax.plot(x_smooth, y_smooth, 
        color='#e74c3c', 
        linewidth=3, 
        alpha=0.9, 
        label=f'Exponential Fit',
        zorder=4)

# Add trend line
ax.plot(df['Year'], df['Count'], 
        color='#3498db', 
        linewidth=2, 
        alpha=0.7, 
        linestyle='--',
        label='Actual Trend',
        zorder=3)

# Customize the plot
ax.set_title('Med City Publications by Year\nRochester Medical Research Growth (1990-2024)', 
             fontsize=20, 
             fontweight='bold', 
             color='#2c3e50',
             pad=20)

ax.set_xlabel('Year', fontsize=14, fontweight='bold', color='#2c3e50')
ax.set_ylabel('Number of Publications', fontsize=14, fontweight='bold', color='#2c3e50')

# Format axes
ax.grid(True, alpha=0.3, linestyle='-', linewidth=0.5)
ax.set_xlim(1989, 2025)
ax.set_ylim(0, max(df['Count']) * 1.1)

# Format y-axis to show values in thousands
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x/1000:.1f}K'))

# Add legend
ax.legend(loc='upper left', fontsize=12, frameon=True, fancybox=True, shadow=True)

# Add annotations for key milestones
ax.annotate('Steady Growth Period', 
            xy=(1995, 1386), xytext=(1995, 3000),
            arrowprops=dict(arrowstyle='->', color='#7f8c8d', alpha=0.7),
            fontsize=10, color='#7f8c8d', ha='center')

ax.annotate('Acceleration Phase', 
            xy=(2013, 3760), xytext=(2010, 6000),
            arrowprops=dict(arrowstyle='->', color='#7f8c8d', alpha=0.7),
            fontsize=10, color='#7f8c8d', ha='center')

ax.annotate('Peak Output', 
            xy=(2021, 10478), xytext=(2018, 11500),
            arrowprops=dict(arrowstyle='->', color='#e74c3c', alpha=0.8),
            fontsize=12, color='#e74c3c', ha='center', fontweight='bold')

# Add statistics box
stats_text = f'''Key Statistics:
• Total Publications: {df['Count'].sum():,}
• Peak Year: {df.loc[df['Count'].idxmax(), 'Year']} ({df['Count'].max():,})
• Growth Rate: ~{((df['Count'].iloc[-1]/df['Count'].iloc[0])**(1/34)-1)*100:.1f}% annually
• Doubling Time: ~{np.log(2)/popt[1]:.1f} years''' if len(popt) > 1 else f'''Key Statistics:
• Total Publications: {df['Count'].sum():,}
• Peak Year: {df.loc[df['Count'].idxmax(), 'Year']} ({df['Count'].max():,})
• Recent 5-year avg: {df.tail(5)['Count'].mean():.0f}'''

ax.text(0.02, 0.98, stats_text,
        transform=ax.transAxes,
        fontsize=10,
        verticalalignment='top',
        bbox=dict(boxstyle='round,pad=0.5', facecolor='white', alpha=0.9, edgecolor='#bdc3c7'),
        color='#2c3e50')

# Adjust layout and save
plt.tight_layout()

# Save as high-quality PNG
plt.savefig('c:/Users/hanna/OneDrive/Documents/MedCityAI/MedCityAI2/images/med_city_publications_graph.png', 
            dpi=300, 
            bbox_inches='tight', 
            facecolor='#f8f9fa',
            edgecolor='none',
            transparent=False)

# Also save as web-optimized version
plt.savefig('c:/Users/hanna/OneDrive/Documents/MedCityAI/MedCityAI2/images/med_city_publications_web.png', 
            dpi=150, 
            bbox_inches='tight', 
            facecolor='#f8f9fa',
            edgecolor='none',
            transparent=False)

print("Graph saved successfully!")
print(f"High-res version: med_city_publications_graph.png")
print(f"Web version: med_city_publications_web.png")

# Show the plot
plt.show()