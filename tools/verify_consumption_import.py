"""Read-only comparison of an exported MyWork DB with the normalized history."""
import json,sys,math
from pathlib import Path
import openpyxl
w=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)
def records(name):
 rows=iter(w[name].values);headers=next(rows)
 return [dict(zip(headers,row)) for row in rows if row and row[0] is not None]
def canonical(code):return 'VTB' if code=='VBD' else code
markets={r['MarketID']:canonical(r['ShortName']) for r in records('30_MARKETS')}
is_vtg=len(sys.argv)>4 and sys.argv[4]=='VTG'
if is_vtg:markets['VTG']='VTG'
actual=records('33_VTG_CONSUMPTION' if is_vtg else '32_MOBILE_CONSUMPTION');source=json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
def key(r):return (markets[r['MarketID']],int(r['Year']),int(r['Month']),r['Scenario'])
index={key(r):r for r in actual};errors=[]
if len(index)!=len(actual):errors.append('Duplicate keys in Sheet')
if len(actual)!=len(source):errors.append('Record count differs')
def equal(a,b):
 if a in ('',None):return b in ('',None)
 if isinstance(a,(int,float)):return isinstance(b,(int,float)) and math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-9)
 return str(a).strip()==str(b or '').strip()
for r in source:
 k=(r['marketCode'],r['year'],r['month'],r['scenario']);a=index.get(k)
 if a is None:errors.append(f'Missing {k}');continue
 for field in ['total','voice','sms','data','vas']:
  expected=r[field]
  if field=='total' and expected=='' and all(r[f]!='' for f in ['voice','sms','data','vas']):expected=sum(r[f] for f in ['voice','sms','data','vas'])
  header={'total':'Total','voice':'Voice','sms':'SMS','data':'Data','vas':'VAS'}[field]
  if not equal(expected,a[header]):errors.append(f'{k} differs: {header}')
 for f in ['source','status']:
  if not equal(r[f],a[f.title()]):errors.append(f'{k} differs: {f}')
 if a['Unit']!='USD_THOUSAND' or a['Revision']!=1:errors.append(f'{k} unit/revision mismatch')
audit=[r for r in records('90_AUDIT_LOG') if r['EntityType']==('VTG_CONSUMPTION' if is_vtg else 'MOBILE_CONSUMPTION')]
ids=[r['RecordID'] for r in actual];auditids=[r['EntityID'] for r in audit]
if len(auditids)!=len(ids) or set(auditids)!=set(ids):errors.append('Audit coverage/count differs')
byid={r['RecordID']:r for r in actual}
for entry in audit:
 saved=json.loads(entry['NewValue']);a=byid.get(entry['EntityID'])
 if a is None:continue
 for f in ['RecordID','MarketID','Year','Month','Scenario','Total','Voice','SMS','Data','VAS','Source','Reconciliation','Revision']:
  if not equal(saved.get(f),a.get(f)):errors.append(f'Audit differs: {entry["EntityID"]} {f}')
summary={'records':len(actual),'uniquePeriods':len(index),'auditRecords':len(audit),'mismatchedBreakdowns':sum(r['Reconciliation']=='MISMATCH' for r in actual),'sourceRecords':len(source),'errors':errors,'pass':not errors}
Path(sys.argv[3]).write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(summary,ensure_ascii=False));sys.exit(bool(errors))
