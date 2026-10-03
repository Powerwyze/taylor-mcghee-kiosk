export class LiveTools {
  constructor({send,execute}){this.send=send;this.execute=execute;this.responses=new Map();this.current=new Map();this.calls=new Map();}
  clear(){this.responses.clear();this.current.clear();this.calls.clear();}
  async receive(envelope){
    if(envelope.type!=='response.event')return;
    const e=envelope.event;
    if(!e)return;
    const delegation=envelope.delegation_id;
    if(e.type==='response.created'){
      this.current.set(delegation,e.response.id);
      this.responses.set(e.response.id,{calls:[],continued:false});
      return;
    }
    const id=e.response_id || e.response?.id || this.current.get(delegation);
    const record=this.responses.get(id);
    if(!record)return;
    if(e.type==='response.output_item.done' && e.item?.type==='function_call'){
      const item=e.item;
      if(!this.calls.has(item.call_id)){
        // Start execution once; the response's terminal event controls continuation.
        const promise=Promise.resolve().then(()=>{
          let args;try{args=JSON.parse(item.arguments);}catch{return {error:'Invalid tool arguments.'};}
          return this.execute(item.name,args);
        }).catch(()=>({error:'The booth action failed. Check status before retrying.'}));
        this.calls.set(item.call_id,promise);
      }
      if(!record.calls.includes(item.call_id))record.calls.push(item.call_id);
    }
    if(e.type==='response.completed' && record.calls.length && !record.continued){
      record.continued=true;
      const results=await Promise.all(record.calls.map(async call_id=>({call_id,output:await this.calls.get(call_id)})));
      if(!this.responses.has(id))return; // Session was closed while a tool was pending.
      for(const r of results)this.send({type:'response.item.create',item:{type:'function_call_output',call_id:r.call_id,output:JSON.stringify(r.output)}});
      this.send({type:'response.create'});
      this.responses.delete(id);
    }
    if(['response.failed','response.incomplete','response.cancelled'].includes(e.type))this.responses.delete(id);
  }
}
