import pandas as pd
import json
from math import radians, sin, cos, sqrt, atan2
from datetime import timedelta
import numpy as np

# Load your sample dataset
df_sample = pd.read_csv("sample_trips.csv")

# Define user home and work locations
user_locations = {
    'user_1': {'home_lat': 38.015, 'home_lon': 23.785, 'work_lat': 38.03, 'work_lon': 23.83},
    'user_2': {'home_lat': 38.02, 'home_lon': 23.78, 'work_lat': 38.04, 'work_lon': 23.82},
    # Add more users as needed
}

# For demonstration, assign user locations randomly
unique_users = df_sample['userId'].unique()
user_locations = {}
for user in unique_users:
    user_locations[user] = {
        'home_lat': 38.0 + np.random.uniform(-0.05, 0.05),
        'home_lon': 23.8 + np.random.uniform(-0.05, 0.05),
        'work_lat': 38.0 + np.random.uniform(-0.05, 0.05),
        'work_lon': 23.8 + np.random.uniform(-0.05, 0.05)
    }


# Haversine formula for distance calculation
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0  # Earth radius in kilometers
    lat1_rad, lon1_rad = radians(lat1), radians(lon1)
    lat2_rad, lon2_rad = radians(lat2), radians(lon2)
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = sin(dlat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


# Extract coordinates from strings and calculate distances
df_sample['start_lat'] = df_sample['start_coord'].apply(lambda x: float(x.strip("()").split(",")[0]))
df_sample['start_lon'] = df_sample['start_coord'].apply(lambda x: float(x.strip("()").split(",")[1]))
df_sample['end_lat'] = df_sample['last_coord'].apply(lambda x: float(x.strip("()").split(",")[0]))
df_sample['end_lon'] = df_sample['last_coord'].apply(lambda x: float(x.strip("()").split(",")[1]))

# Calculate distance for each trip segment
df_sample['distance_km'] = df_sample.apply(
    lambda row: haversine_distance(row['start_lat'], row['start_lon'], row['end_lat'], row['end_lon']), axis=1)


# Extract dominant mode from the JSON-like mode data
def get_dominant_mode(mode_json):
    mode_data = json.loads(mode_json.replace("'", '"'))  # Ensure proper JSON format
    dominant_mode = max(mode_data, key=mode_data.get)
    return dominant_mode


df_sample['dominant_mode'] = df_sample['mode'].apply(get_dominant_mode)

# Map the extracted dominant mode to the standard mode names
mode_mapping = {
    "in_vehicle": "Public Transport",
    "on_bicycle": "Cycling",
    "walking": "Walking",
    "scooter": "Electric Scooter",
    "electric_bike": "Electric Bike",
    "car": "Car"
}

df_sample['mode_standard'] = df_sample['dominant_mode'].map(mode_mapping)


# Function to calculate distance from home and work for each trip segment
def calculate_distances(df, user_id):
    user_home_lat = user_locations[user_id]['home_lat']
    user_home_lon = user_locations[user_id]['home_lon']
    user_work_lat = user_locations[user_id]['work_lat']
    user_work_lon = user_locations[user_id]['work_lon']

    df['distance_from_home_start'] = df.apply(
        lambda row: haversine_distance(row['start_lat'], row['start_lon'], user_home_lat, user_home_lon), axis=1)
    df['distance_from_home_end'] = df.apply(
        lambda row: haversine_distance(row['end_lat'], row['end_lon'], user_home_lat, user_home_lon), axis=1)
    df['distance_from_work_start'] = df.apply(
        lambda row: haversine_distance(row['start_lat'], row['start_lon'], user_work_lat, user_work_lon), axis=1)
    df['distance_from_work_end'] = df.apply(
        lambda row: haversine_distance(row['end_lat'], row['end_lon'], user_work_lat, user_work_lon), axis=1)

    return df


# Apply distance calculations for each user
df_sample = df_sample.groupby('userId').apply(lambda df: calculate_distances(df, df['userId'].iloc[0]))


# Classify stop types
def classify_stop_type(row):
    home_threshold = 0.5  # 0.5 km
    work_threshold = 0.5  # 0.5 km

    if row['distance_from_home_end'] < home_threshold:
        return "Home"
    elif row['distance_from_work_end'] < work_threshold:
        return "Work"
    else:
        return "Intermediate"


df_sample['stop_type'] = df_sample.apply(classify_stop_type, axis=1)

# Assign trip IDs based on time gaps and stop types
df_sample.sort_values(by=['userId', 'startTime'], inplace=True)

df_sample['startTime_dt'] = pd.to_datetime(df_sample['startTime'], errors='coerce')
df_sample['endTime_dt'] = pd.to_datetime(df_sample['endTime'], errors='coerce')

# Fill missing times
df_sample['startTime_dt'].fillna(method='ffill', inplace=True)
df_sample['endTime_dt'].fillna(method='ffill', inplace=True)


# Assign tour IDs
def assign_tour_ids(df):
    tour_id = 0
    df['tour_id'] = 0
    for i in range(len(df)):
        if i == 0:
            tour_id += 1
        else:
            time_gap = df.iloc[i]['startTime_dt'] - df.iloc[i - 1]['endTime_dt']
            if time_gap > pd.Timedelta(hours=1):
                tour_id += 1
            elif df.iloc[i - 1]['stop_type'] == 'Home' and df.iloc[i]['stop_type'] == 'Intermediate':
                pass  # Continue same tour
            elif df.iloc[i - 1]['stop_type'] == 'Intermediate' and df.iloc[i]['stop_type'] == 'Work':
                pass  # Continue same tour
            elif df.iloc[i - 1]['stop_type'] == 'Work' and df.iloc[i]['stop_type'] == 'Intermediate':
                pass  # Continue same tour
            elif df.iloc[i - 1]['stop_type'] == 'Intermediate' and df.iloc[i]['stop_type'] == 'Home':
                pass  # Continue same tour
            else:
                tour_id += 1  # Start a new tour
        df.at[df.index[i], 'tour_id'] = tour_id
    return df


df_sample = df_sample.groupby('userId').apply(assign_tour_ids)


# Summarize tours
def summarize_tours(df):
    tour_summary = []
    for (user_id, tour_id), group in df.groupby(['userId', 'tour_id']):
        total_distance = group['distance_km'].sum()
        modes_used = group['mode_standard'].unique()
        start_stop_type = group.iloc[0]['stop_type']
        end_stop_type = group.iloc[-1]['stop_type']

        # Determine if it's a Home-Work or Work-Home tour
        if start_stop_type == 'Home' and end_stop_type == 'Work':
            tour_type = 'Home-Work'
        elif start_stop_type == 'Work' and end_stop_type == 'Home':
            tour_type = 'Work-Home'
        else:
            tour_type = 'Other'

        tour_summary.append({
            'userId': user_id,
            'tour_id': tour_id,
            'tour_type': tour_type,
            'total_distance_km': total_distance,
            'modes_used': modes_used,
            'stop_types': group['stop_type'].tolist(),
            'is_work_tour': 1 if tour_type in ['Home-Work', 'Work-Home'] else 0
        })
    return pd.DataFrame(tour_summary)


df_tour_summary = summarize_tours(df_sample)

# Define sustainable modes and their weighting factors
sustainable_modes = {
    "Public Transport": {"0-5": 1.0, "5-10": 1.2, "10-20": 1.3, "20+": 1.4},
    "Cycling": {"0-5": 1.0, "5-10": 1.5, "10-20": 2.0, "20+": 2.5},
    "Walking": {"0-5": 1.0, "5-10": 1.5, "10-20": 2.0, "20+": 2.5},
    "Electric Scooter": {"0-5": 1.0, "5-10": 1.2, "10-20": 1.3, "20+": 1.4},
    "Electric Bike": {"0-5": 1.0, "5-10": 1.2, "10-20": 1.3, "20+": 1.4},
    # Car is not considered sustainable
}


# Determine distance range for weighting factors
def get_distance_range(distance_km):
    if distance_km <= 5:
        return "0-5"
    elif distance_km <= 10:
        return "5-10"
    elif distance_km <= 20:
        return "10-20"
    else:
        return "20+"


# Calculate points for each tour
def calculate_tour_points(row):
    if row['is_work_tour'] == 0:
        return 0  # No points for non-work tours

    total_distance = row['total_distance_km']
    distance_range = get_distance_range(total_distance)

    # Calculate total sustainable distance
    tour_df = df_sample[(df_sample['userId'] == row['userId']) & (df_sample['tour_id'] == row['tour_id'])]

    sustainable_leg_distances = tour_df[tour_df['mode_standard'].isin(sustainable_modes.keys())]['distance_km']
    sustainable_distance = sustainable_leg_distances.sum()

    if sustainable_distance == 0:
        return 0  # No sustainable travel, no points

    proportion_sustainable = sustainable_distance / total_distance
    base_point = 1  # Base point per tour

    # Calculate weighted average weighting factor
    total_weighted_factor = 0
    for mode in tour_df['mode_standard'].unique():
        if mode in sustainable_modes:
            mode_distance = tour_df[tour_df['mode_standard'] == mode]['distance_km'].sum()
            mode_weighting = sustainable_modes[mode][distance_range]
            total_weighted_factor += mode_weighting * (mode_distance / sustainable_distance)

    total_points = base_point * total_weighted_factor * proportion_sustainable
    return total_points


df_tour_summary['points'] = df_tour_summary.apply(calculate_tour_points, axis=1)

# Display the tour summary with points
print(df_tour_summary[['userId', 'tour_id', 'tour_type', 'total_distance_km', 'modes_used', 'points']])

# Save the results
df_tour_summary.to_csv("tour_points_results.csv", index=False)
