"""Generate a SYNTHETIC demo dataset (for testing / college demo only, not real sales).

Usage:  python generate_sample_data.py
Output: ../sample_data/sample_dataset.csv

Units_Sold depends on price, discount, footfall, holiday flag and last week's sales
plus random noise, so the ML models have a real pattern to learn.
"""
import os

import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
N = 1500

items = [f"ITEM{str(i).zfill(3)}" for i in range(1, 21)]
stores = [f"STORE{i}" for i in range(1, 6)]
item_pop = {it: rng.uniform(0.6, 1.6) for it in items}      # item popularity
store_size = {st: rng.uniform(0.8, 1.4) for st in stores}    # store size effect

rows = []
for _ in range(N):
    item = rng.choice(items)
    store = rng.choice(stores)
    base_price = round(rng.uniform(20, 500), 2)
    discount = round(rng.choice([0, 0, 5, 10, 15, 20, 30]), 1)
    footfall = int(rng.integers(200, 2000))
    holiday = int(rng.random() < 0.15)
    past_week = int(max(0, rng.normal(60 * item_pop[item] * store_size[store], 15)))
    demand = (
        0.55 * past_week
        + 0.012 * footfall * item_pop[item]
        + 0.9 * discount
        + 12 * holiday
        - 0.03 * base_price
        + rng.normal(0, 6)
    )
    rows.append([item, store, base_price, discount, footfall, holiday, past_week, max(0, int(round(demand)))])

df = pd.DataFrame(
    rows,
    columns=["Item_ID", "Store_ID", "Item_Base_Price", "Discount_Applied", "Store_Footfall",
             "Is_Holiday", "Past_Week_Sales", "Units_Sold"],
)
out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sample_data")
os.makedirs(out_dir, exist_ok=True)
df.to_csv(os.path.join(out_dir, "sample_dataset.csv"), index=False)
print(f"Wrote {len(df)} rows to sample_data/sample_dataset.csv")
