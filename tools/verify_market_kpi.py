import openpyxl,json,sys,math
from pathlib import Path
w=openpyxl.load_workbook(sys.argv[1],data_only=True,read_only=True)
def rows(name):
 it=iter(w[name].values);h=next(it);return [dict(zip(h,r)) for r in it if r[0]]
a=rows('34_MARKET_KPI');source=json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'));errors=[]
idx={(r['MarketCode'],r['Year'],r['Month']):r for r in a}
if len(idx)!=len(a) or len(a)!=len(source):errors.append('count/duplicate')
for r in source:
 actual=idx.get((r['marketCode'],r['year'],r['month']))
 if not actual:errors.append('missing '+r['marketCode']);continue
 v=json.loads(actual['ValuesJSON'])
 for k,x in r['values'].items():
  if x is None:ok=v[k] is None
  else:ok=math.isclose(x,v[k],rel_tol=1e-12,abs_tol=1e-12)
  if not ok:errors.append(r['marketCode']+' '+k)
 if json.loads(actual['ReferenceJSON'])!=r['references']:errors.append('references '+r['marketCode'])
 if actual['Source']!=r['source']:errors.append('source '+r['marketCode'])
aud=[r for r in rows('90_AUDIT_LOG') if r['EntityType']=='MARKET_KPI']
for r in a:
 history=[x for x in aud if x['EntityID']==r['RecordID']]
 if not history:errors.append('audit missing');continue
 saved=json.loads(history[-1]['NewValue'])
 if saved['ValuesJSON']!=r['ValuesJSON'] or saved['Revision']!=r['Revision']:errors.append('audit mismatch')
result={'records':len(a),'auditRecords':len(aud),'valuesCompared':sum(len(r['values']) for r in source),'errors':errors,'pass':not errors}
Path(sys.argv[3]).write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result));sys.exit(bool(errors))
