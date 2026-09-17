import pdfplumber
import pandas as pd

pdf_path = "data/raw/landslide_report.pdf" 
all_tables = []

print("⏳ Extracting tables from PDF...")

try:
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            extracted = page.extract_tables()
            for table in extracted:
                if table and len(table) > 1:
                    # Clean header row and remove duplicates/nones
                    raw_headers = [str(col).strip() if col else f"col_{j}" for j, col in enumerate(table[0])]
                    
                    # Deduplicate header names if repeated
                    headers = []
                    for col in raw_headers:
                        count = headers.count(col)
                        headers.append(f"{col}_{count}" if count > 0 else col)
                    
                    # Convert to DataFrame with clean unique headers
                    df = pd.DataFrame(table[1:], columns=headers)
                    all_tables.append(df)

    if all_tables:
        # Ignore individual column mismatch errors during concat
        final_df = pd.concat(all_tables, axis=0, ignore_index=True)
        
        # Save output CSV
        output_path = "data/raw/gsi_landslide_data.csv"
        final_df.to_csv(output_path, index=False)
        print(f"✅ Success! Extracted {len(all_tables)} tables into '{output_path}'.")
    else:
        print("⚠️ No structured tables detected in the PDF.")

except Exception as e:
    print(f"❌ Error during processing: {e}")