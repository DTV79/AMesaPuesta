#!/usr/bin/env node
// Valida un respaldo JSON de la API antigua de Google Apps Script.
// Solo lectura: no modifica Google, Supabase ni ningún fichero.
// No imprime nombres, correos ni elecciones de votantes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateBackup(data) {
  const errors=[],warnings=[];
  if(!data||typeof data!=='object'||!Array.isArray(data.polls)){
    return {ok:false,errors:['El JSON debe contener un array polls.'],warnings,summary:null};
  }
  const summary={encuestas:data.polls.length,abiertas:0,cerradas:0,
    porTipo:{publica:0,secreta:0,participacion:0},
    opciones:0,votosEnOpciones:0,participantesDeclarados:0,cofradesEnExportacion:Array.isArray(data.cofrades)?data.cofrades.length:0,
    abiertasNoMigrables:0};
  const ids=new Set();
  for(const [i,p] of data.polls.entries()){
    const ref='Encuesta #'+(i+1);
    if(!p||typeof p!=='object'){errors.push(ref+': formato no válido.');continue;}
    const id=String(p.id??'').trim();
    if(!id){errors.push(ref+': sin ID original.');}
    else if(ids.has(id)){errors.push(ref+': ID duplicado.');}
    ids.add(id);
    if(!String(p.title??'').trim())errors.push(ref+': sin título.');
    if(!['publica','secreta','participacion'].includes(p.type)){
      errors.push(ref+': tipo de privacidad desconocido.');
    }else summary.porTipo[p.type]++;
    if(!['abierta','cerrada'].includes(p.status))errors.push(ref+': estado desconocido.');
    else if(p.status==='abierta'){summary.abiertas++;summary.abiertasNoMigrables++;}
    else summary.cerradas++;
    if(!Array.isArray(p.options)||p.options.length<2||p.options.length>20){
      errors.push(ref+': se requieren entre 2 y 20 opciones.');
      continue;
    }
    const max=Number(p.maxChoices??p.max_choices??1);
    if(!Number.isInteger(max)||max<1||max>p.options.length)errors.push(ref+': maxChoices no válido.');
    const names=new Set();
    let votes=0;
    for(const [j,o] of p.options.entries()){
      const name=String(o?.name??'').trim();
      if(!name)errors.push(ref+': opción #'+(j+1)+' sin texto.');
      if(names.has(name.toLowerCase()))errors.push(ref+': opciones duplicadas.');
      names.add(name.toLowerCase());
      const count=Number(o?.votes??0);
      if(!Number.isInteger(count)||count<0)errors.push(ref+': recuento inválido en opción #'+(j+1)+'.');
      else votes+=count;
      if(p.type==='publica'&&p.showResults!==false&&p.status==='cerrada'&&Array.isArray(o?.voters)
        &&o.voters.length!==count){
        warnings.push(ref+': la lista pública de votantes no coincide con el recuento de una opción.');
      }
    }
    summary.opciones+=p.options.length;
    summary.votosEnOpciones+=votes;
    const total=Number(p.totalVotes??votes);
    if(!Number.isInteger(total)||total<0||total!==votes){
      errors.push(ref+': totalVotes no coincide con la suma de opciones.');
    }
    const participants=Number(p.votedEligibleCount??0);
    if(!Number.isInteger(participants)||participants<0)errors.push(ref+': participantes inválidos.');
    else summary.participantesDeclarados+=participants;
    if(participants>0&&votes<participants)warnings.push(ref+': hay menos elecciones que participantes.');
    if(p.type==='secreta'&&Array.isArray(p.votedMembers)&&p.votedMembers.length){
      warnings.push(ref+': hay nombres en una encuesta secreta; deben excluirse del respaldo que se publique.');
    }
    if(p.status==='cerrada'&&!p.closedAt&&!p.closes){
      warnings.push(ref+': no consta fecha de cierre; revisar antes de migrar.');
    }
    if(p.status==='abierta'&&votes>0){
      warnings.push(ref+': encuesta abierta con votos; no migrar hasta coordinar cierre y corte de escritura.');
    }
  }
  if(summary.abiertasNoMigrables)warnings.push('Hay encuestas abiertas: no importarlas como activas mientras Google siga aceptando votos.');
  return {ok:errors.length===0,errors,warnings,summary};
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  const file=process.argv[2];
  if(!file){
    console.error('Uso: node scripts/verificar_encuestas_google.mjs <respaldo-google.json>');
    process.exitCode=2;
  }else{
    try{
      const data=JSON.parse(readFileSync(file,'utf8'));
      const result=validateBackup(data);
      console.log(JSON.stringify(result,null,2));
      if(!result.ok)process.exitCode=1;
    }catch(error){
      console.error('No se pudo validar el respaldo:',error.message);
      process.exitCode=1;
    }
  }
}
