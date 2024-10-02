# Micro-Incentive Campaign: Home-Work Tour Analysis

This repository contains the code for analyzing and calculating points for a micro-incentive campaign aimed at promoting sustainable transportation modes for **Home-Work** and **Work-Home** tours. The project focuses on classifying and evaluating complex trips that include intermediate stops, and awarding points based on the proportion of sustainable travel modes used.

## Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Data Format](#data-format)
- [Usage Instructions](#usage-instructions)
- [Project Structure](#project-structure)
- [Example Output](#example-output)

## Project Overview
The **Micro-Incentive Campaign: Home-Work Tour Analysis** module is designed to support micro-incentive campaigns by analyzing travel patterns between home and work. It groups individual trip segments into cohesive **tours**, identifies intermediate stops, and classifies each tour as:

- **Home → Work** (with or without intermediate stops)
- **Work → Home** (with or without intermediate stops)
- **Other Tours**

The code calculates points for each tour based on the distance and modes of transport used, rewarding users for sustainable travel behavior such as using public transport, cycling, or walking.

## Features
- **Trip Segmentation:** Segments GPS-based travel data into distinct trips based on time gaps and location proximity.
- **Tour Classification:** Classifies tours as **Home-Work**, **Work-Home**, or **Other** based on the start and end locations.
- **Intermediate Stop Detection:** Identifies intermediate stops (e.g., shopping, dining) along the tour path.
- **Point Calculation:** Computes points for each tour using weighting factors for sustainable modes and distance ranges.
- **Data Visualization and Reporting:** Provides a summary of the points awarded for each user and each tour.

## Data Format
The project expects a CSV file (`sample_trips.csv`) as input, containing the following fields for each trip segment:

| Column Name      | Description                                                           |
|------------------|-----------------------------------------------------------------------|
| `userId`         | Unique identifier for each user                                       |
| `startTime`      | Start time of the trip segment (format: `HH:MM:SS.s`)                  |
| `endTime`        | End time of the trip segment (format: `HH:MM:SS.s`)                    |
| `segment`        | Type of trip segment (`Moving` or `Activity`)                          |
| `mode`           | JSON string indicating mode probabilities (e.g., `{"walking": 50, ...}`) |
| `start_coord`    | Latitude and longitude of trip start (e.g., `(38.015, 23.785)`)        |
| `last_coord`     | Latitude and longitude of trip end (e.g., `(38.030, 23.830)`)          |
| `duration`       | Duration of the trip segment                                          |
| `purpose`        | Activity purpose (e.g., `Work`, `Meal`, `Leisure`)                     |
| `is_work_trip`   | Boolean indicating if the segment is part of a work-related trip       |

## Installation
### Prerequisites
- **Python 3.7+**
- Required libraries:
  - `pandas`
  - `numpy`
  - `datetime`
  - `json`

## Usage Instructions
The project identifies and groups complex travel patterns and calculates points based on the following rules:

- **Distance Weighting:** Points are awarded based on the total distance of the tour:
  - **0-5 km:** Base points multiplied by 1.0
  - **5-10 km:** Base points multiplied by 1.2 (1.5 for active modes)
  - **10-20 km:** Base points multiplied by 1.3 (2.0 for active modes)
  - **20+ km:** Base points multiplied by 1.4 (2.5 for active modes)
  
- **Sustainable Modes:**
  - Public Transport, Cycling, Walking, Electric Scooter, Electric Bike
  
- **Proportional Scoring:**
  - Points are awarded proportionally based on the proportion of sustainable distance within each tour.


## Example Output
Here’s an example of the output from the `tour_points_results.csv`:

| userId  | tour_id | tour_type   | total_distance_km | modes_used                  | points |
|---------|---------|-------------|-------------------|----------------------------|--------|
| user_1  | 1       | Home-Work   | 15.2              | `['Public Transport', 'Walking']` | 2.1    |
| user_2  | 2       | Work-Home   | 8.7               | `['Cycling']`              | 2.0    |
| user_1  | 3       | Other       | 5.3               | `['Car']`                  | 0.0    |


### Issues and Suggestions
If you encounter any issues or have suggestions for improvements, please open an issue in the repository.


## Contact
For questions or further information, feel free to reach out:

- **Project Maintainer:** Giannis Tsouros
- **Email:** [j.tsouros@mobyx.co](mailto:j.tsouros@mobyx.co)

