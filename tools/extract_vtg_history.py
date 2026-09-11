"""Extract the original VTG block separately; never add it to child markets."""
import openpyxl,json,sys,math
from pathlib import Path
from openpyxl.utils import column_index_from_string as colnum,get_column_letter as colname
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
s=openpyxl.load_workbook(src,data_only=True)['TD thuc']
periods=[(2012,0,'D','ACTUAL'),(2013,0,'E','ACTUAL'),(2014,0,'F','ACTUAL'),(2015,0,'G','ACTUAL'),(2016,0,'H','ACTUAL'),(2017,0,'I','ACTUAL'),(2017,0,'J','PLAN'),(2018,0,'K','PLAN')]
for year,col in [(2014,'AJ'),(2015,'AX'),(2016,'BL'),(2017,'BZ'),(2018,'CO'),(2019,'EJ'),(2020,'EW'),(2021,'FO'),(2022,'GH'),(2023,'HA'),(2024,'HT'),(2025,'IM'),(2026,'JF')]:
 for month in range(1,13):periods.append((year,month,colname(colnum(col)+month-1),'ACTUAL'))
for year,col in [(2018,'DC'),(2019,'DU')]:
 for month in range(1,13):periods.append((year,month,colname(colnum(col)+month-1),'PLAN'))
records=[];errors=[]
for year,month,col,scenario in periods:
 values=[s[f'{col}{row}'].value for row in range(11,16)]
 if all(x in (None,'') for x in values):continue
 if any(x not in (None,'') and (not isinstance(x,(int,float)) or isinstance(x,bool) or not math.isfinite(x) or x<0) for x in values):errors.append({'year':year,'month':month,'column':col,'values':values});continue
 r={'marketCode':'VTG','year':year,'month':month,'scenario':scenario,'inputMode':'AMOUNTS','status':'DRAFT','source':f'{src.name} | TD thuc!{col}11:{col}15','note':'VTG original source; thousand USD. Formula totals may include VTCM. Stored separately from market consolidation. '+('Original annual summary takes precedence over monthly sum for full-year report.' if month==0 else '')}
 r.update(zip(['total','voice','sms','data','vas'],['' if x is None else x for x in values]));records.append(r)
(out/'PR06_VTG_history_import.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'PR06_VTG_history_review.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'ready':len(records),'annual':sum(r['month']==0 for r in records),'review':len(errors)},ensure_ascii=False))
