const $ = id => document.getElementById(id);
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const noteNames = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const vowelForLetter = {A:"a",B:"e",C:"a",D:"e",E:"i",F:"e",G:"a",H:"a",I:"i",J:"i",K:"e",L:"e",M:"a",N:"e",O:"o",P:"e",Q:"u",R:"a",S:"e",T:"i",U:"u",V:"i",W:"u",X:"e",Y:"i",Z:"e"};
let audioCtx = null, master = null, activeVoices = new Map(), midiAccess = null, lastNote = 60, singerEngine = null;
let projectSaved = false;
function audioReady(){
  if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();master=audioCtx.createGain();master.gain.value=Number($('volume').value)/100;master.connect(audioCtx.destination);if(window.WaveySingerEngine)singerEngine=new window.WaveySingerEngine(audioCtx,master);}
  if(audioCtx.state==="suspended") audioCtx.resume();
  return audioCtx;
}
function setLCD(text,note){
  $('lcdText').textContent=String(text||"").toUpperCase().slice(0,28);
  if(note!==undefined){const n=((note%12)+12)%12;$('noteReadout').textContent="NOTE: "+noteNames[n]+(Math.floor(note/12)-1);}
}
function selectedVowel(){return $('vowel').value;}
function frequencyForMidi(note){
  const keyOffset=Math.max(0,noteNames.indexOf($('keySelect').value));
  const shifted=note+keyOffset+Number($('pitchShift').value);
  return 440*Math.pow(2,(shifted-69)/12);
}
function formantFor(vowel,bright){
  const f={a:[800,1150,2900],e:[500,1900,2600],i:[300,2200,3000],o:[500,900,2600],u:[350,800,2200]}[vowel]||[800,1150,2900];
  return f.map((v,i)=>v*(i===0?0.8+bright*.5:1));
}
function startVoice(id,note,vowel,velocity=0.8){
  audioReady(); stopVoice(id,0.035);
  const now=audioCtx.currentTime, freq=frequencyForMidi(note), bright=Number($('brightness').value)/100;
  const mix=Number($('singMix').value)/100, character=$('voiceStyle').value;
  const charShift=character==="masculine"?0.72:character==="feminine"?1.18:0.92;
  const osc=audioCtx.createOscillator(), sub=audioCtx.createOscillator(), gain=audioCtx.createGain();
  const f= formantFor(vowel,bright);
  const filters=f.map((hz,i)=>{const b=audioCtx.createBiquadFilter();b.type="bandpass";b.frequency.value=hz*charShift;b.Q.value=i===0?2.4:4.2;return b;});
  const formGain=audioCtx.createGain();formGain.gain.value=0.22+mix*0.52;
  osc.type=mix>0.6?"sawtooth":"square";osc.frequency.setValueAtTime(freq,now);
  sub.type="triangle";sub.frequency.setValueAtTime(freq*0.5,now);
  const oscGain=audioCtx.createGain();oscGain.gain.value=0.14+(1-mix)*0.18;
  osc.connect(oscGain);oscGain.connect(filters[0]);sub.connect(filters[1]);filters.forEach((b,i)=>{b.connect(formGain);if(i<filters.length-1)filters[i+1].connect(formGain);});
  formGain.connect(gain);oscGain.connect(gain);gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(0.02,velocity*0.45),now+0.025);gain.connect(master);
  const vib=audioCtx.createOscillator(), vibGain=audioCtx.createGain();vib.frequency.value=5.2;vibGain.gain.value=freq*(Number($('vibrato').value)/100)*0.012*mix;vib.connect(vibGain);vibGain.connect(osc.frequency);vibGain.connect(sub.frequency);
  osc.start(now);sub.start(now);vib.start(now);
  const voice={osc,sub,vib,gain,filters,formGain,oscGain,vibGain};
  activeVoices.set(id,voice);lastNote=note;setLCD(vowel.toUpperCase()+"  ♪",note);
}
function stopVoice(id,release=0.12){
  const v=activeVoices.get(id);if(!v||!audioCtx)return;
  const now=audioCtx.currentTime;v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0.0001,now,Math.max(0.015,release/4));
  [v.osc,v.sub,v.vib].forEach(o=>{try{o.stop(now+release+0.08)}catch(e){}});
  activeVoices.delete(id);
}
function stopAll(){if(singerEngine)singerEngine.stop();for(const id of [...activeVoices.keys()])stopVoice(id,0.06);if("speechSynthesis"in window)speechSynthesis.cancel();$('statusText').textContent="STOPPED";setLCD("READY");}
function makeLetterPad(){
  const pad=$('letterPad');
  letters.forEach(letter=>{const b=document.createElement("button");b.className="letter-key";b.textContent=letter;b.dataset.letter=letter;b.setAttribute("aria-label","Play letter "+letter);b.addEventListener("pointerdown",e=>{e.preventDefault();const v=vowelForLetter[letter]||"a";$('vowel').value=v;const note=60+letters.indexOf(letter)%12+Number($('octaveSelect').value-4)*12;startVoice("letter-"+letter,note,v,0.8);setLCD(letter,note);b.classList.add("pressed")});const release=()=>{stopVoice("letter-"+letter);b.classList.remove("pressed")};b.addEventListener("pointerup",release);b.addEventListener("pointerleave",release);b.addEventListener("pointercancel",release);pad.appendChild(b);});
}
function makePiano(){
  const piano=$('piano');piano.innerHTML="";
  const base=Number($('octaveSelect').value)*12+12;
  const keyNoteOffsets=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24];
  keyNoteOffsets.forEach((offset,i)=>{
    const note=base+offset, pc=offset%12, black=[1,3,6,8,10].includes(pc);
    const b=document.createElement("button");b.className="piano-key "+(black?"black":"white");b.dataset.note=note;
    b.innerHTML='<span class="key-note">'+noteNames[pc]+'</span><span class="key-oct">'+(Math.floor(note/12)-1)+'</span>';
    const down=e=>{e.preventDefault();const vowel=selectedVowel();startVoice("piano-"+note,note,vowel,0.55+Number($('volume').value)/220);b.classList.add("pressed");};
    const up=()=>{stopVoice("piano-"+note);b.classList.remove("pressed")};
    b.addEventListener("pointerdown",down);b.addEventListener("pointerup",up);b.addEventListener("pointerleave",up);b.addEventListener("pointercancel",up);
    b.addEventListener("contextmenu",e=>e.preventDefault());piano.appendChild(b);
  });
}
function speakText(){
  const text=$('lyricsEditor').value.trim();
  if(!text){setLCD("TYPE LYRICS FIRST");return;}
  audioReady();
  if(!window.WaveySingerEngine || !singerEngine){
    setLCD("SINGING ENGINE UNAVAILABLE");
    $('statusText').textContent="ERROR";
    return;
  }
  stopAll();
  singerEngine.setVoiceStyle($('voiceStyle').value);
  const keyOffset=Math.max(0,noteNames.indexOf($('keySelect').value));
  const baseNote=Math.max(36,Math.min(84,60+keyOffset+Number($('pitchShift').value)));
  const tempo=Number($('tempo').value||96);
  const melody=singerEngine.renderSong(text,{
    tempo, baseNote,
    choirVoices:Number($('choirVoices').value||1),
    spread:Number($('choirSpread').value||0),
    brightness:Number($('brightness').value)/100,
    vibrato:Number($('vibrato').value)/100,
    singingMix:Number($('singMix').value)/100
  });
  if(!melody.length){setLCD("TYPE LYRICS FIRST");return;}
  $('statusText').textContent="SINGING";
  setLCD("SINGING LYRICS",baseNote);
  const endSeconds=Math.max(...melody.map(n=>n.start+n.duration))+0.8;
  window.setTimeout(()=>{
    if($('statusText').textContent==="SINGING"){
      $('statusText').textContent="READY";
      setLCD("VOCAL RENDER READY");
    }
  },endSeconds*1000);
}
function updateLabels(){
  $('singValue').textContent=$('singMix').value+"%";if($('tempoValue'))$('tempoValue').textContent=$('tempo').value+" BPM";if($('choirValue'))$('choirValue').textContent=$('choirVoices').value;if($('choirSpreadValue'))$('choirSpreadValue').textContent=$('choirSpread').value+"¢";$('pitchValue').textContent=Number($('pitchShift').value)>0?"+"+$('pitchShift').value+" st":$('pitchShift').value+" st";
  $('vibratoValue').textContent=$('vibrato').value+"%";$('brightValue').textContent=$('brightness').value+"%";$('volumeValue').textContent=$('volume').value+"%";
  $('voiceReadout').textContent="VOICE: "+$('voiceStyle').selectedOptions[0].text.toUpperCase().slice(0,12);
  if(master&&audioCtx)master.gain.setTargetAtTime(Number($('volume').value)/100,audioCtx.currentTime,0.02);
}
function togglePanel(id){$(id).classList.toggle("hidden")}
$('openSettings').addEventListener("click",()=>{$('settingsPanel').classList.remove("hidden");$('lyricsPanel').classList.add("hidden")});
$('closeSettings').addEventListener("click",()=>togglePanel("settingsPanel"));
$('openLyrics').addEventListener("click",()=>{$('lyricsPanel').classList.remove("hidden");$('settingsPanel').classList.add("hidden")});
$('closeLyrics').addEventListener("click",()=>togglePanel("lyricsPanel"));
$('speakBtn').addEventListener("click",speakText);$('previewText').addEventListener("click",speakText);$('stopBtn').addEventListener("click",stopAll);
$('randomBtn').addEventListener("click",()=>{const vowels=["a","e","i","o","u"];const v=vowels[Math.floor(Math.random()*vowels.length)];$('vowel').value=v;const note=48+Math.floor(Math.random()*25);startVoice("surprise",note,v,0.85);setTimeout(()=>stopVoice("surprise",0.25),650);setLCD("SURPRISE: "+v.toUpperCase(),note)});
['singMix','pitchShift','vibrato','brightness','volume','tempo','choirVoices','choirSpread'].forEach(id=>$(id).addEventListener("input",updateLabels));
$('voiceStyle').addEventListener("change",updateLabels);
$('vowel').addEventListener("change",()=>setLCD("VOWEL: "+$('vowel').value.toUpperCase()));
$('octaveSelect').addEventListener("change",makePiano);
$('keySelect').addEventListener("change",()=>{const key=noteNames.indexOf($('keySelect').value);$('noteReadout').textContent="KEY: "+$('keySelect').value;});
$('scaleSelect').addEventListener("change",()=>{ $('modeReadout').textContent=$('scaleSelect').value==="Chromatic"?"SING MODE":$('scaleSelect').value.toUpperCase()+" MODE";});
$('midiBtn').addEventListener("click",connectMIDI);
function midiNoteOn(note,velocity){const vowel=selectedVowel();startVoice("midi-"+note,note,vowel,Math.max(0.1,velocity/127));}
function handleMIDIMessage(event){const [status,note,velocity]=event.data;const cmd=status&0xf0;if(cmd===0x90&&velocity>0)midiNoteOn(note,velocity);else if(cmd===0x80||(cmd===0x90&&velocity===0))stopVoice("midi-"+note);else if(cmd===0xe0){const bend=((velocity<<7)+note-8192)/8192*2; $('pitchShift').value=Math.max(-12,Math.min(12,Math.round(bend*6)));updateLabels();}}
async function connectMIDI(){
  if(!navigator.requestMIDIAccess){$('midiStatus').textContent="MIDI: unavailable in this build";return;}
  try{midiAccess=await navigator.requestMIDIAccess();midiAccess.inputs.forEach(input=>input.onmidimessage=handleMIDIMessage);midiAccess.onstatechange=()=>{midiAccess.inputs.forEach(input=>input.onmidimessage=handleMIDIMessage);updateMIDIStatus()};updateMIDIStatus();}
  catch(e){$('midiStatus').textContent="MIDI: permission or device unavailable";}
}
function updateMIDIStatus(){const inputs=midiAccess?[...midiAccess.inputs.values()]:[];$('midiStatus').textContent=inputs.length?"MIDI: "+inputs.length+" device(s) ready":"MIDI: connect a keyboard";}
$('saveBtn').addEventListener("click",async()=>{
 const data={app:"Speak or Spell by Wavey Beat",version:"0.2.0",settings:{singMix:$('singMix').value,voiceStyle:$('voiceStyle').value,pitchShift:$('pitchShift').value,vibrato:$('vibrato').value,brightness:$('brightness').value,volume:$('volume').value,vowel:$('vowel').value,key:$('keySelect').value,octave:$('octaveSelect').value,scale:$('scaleSelect').value},text:$('lyricsEditor').value};
 if(window.speakSpell&&window.speakSpell.saveProject){const r=await window.speakSpell.saveProject(data);if(!r.canceled&&!r.error){projectSaved=true;$('statusText').textContent="SAVED";}}
 else{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="speak-or-spell-project.json";a.click();URL.revokeObjectURL(a.href);$('statusText').textContent="PROJECT EXPORTED";}
});
$('exportTxtBtn').addEventListener("click",()=>{const blob=new Blob([$('lyricsEditor').value],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="speak-or-spell-text.txt";a.click();URL.revokeObjectURL(a.href)});
makeLetterPad();makePiano();updateLabels();setLCD("HELLO, SINGER!");connectMIDI();
document.addEventListener("keydown",e=>{if(e.repeat||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;const letter=e.key.toUpperCase();if(letters.includes(letter)){const b=document.querySelector('[data-letter="'+letter+'"]');if(b)b.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true}));}});
document.addEventListener("keyup",e=>{const letter=e.key.toUpperCase();if(letters.includes(letter)){const b=document.querySelector('[data-letter="'+letter+'"]');if(b)b.dispatchEvent(new PointerEvent("pointerup",{bubbles:true}));}});

$('openProjectBtn').addEventListener("click",async()=>{
 if(window.speakSpell&&window.speakSpell.openProject){
  const r=await window.speakSpell.openProject();if(r.canceled)return;if(r.error){alert(r.error);return;}
  const d=r.data||{},s=d.settings||{};
  if(s.singMix!=null)$('singMix').value=s.singMix;if(s.voiceStyle)$('voiceStyle').value=s.voiceStyle;
  if(s.pitchShift!=null)$('pitchShift').value=s.pitchShift;if(s.vibrato!=null)$('vibrato').value=s.vibrato;
  if(s.brightness!=null)$('brightness').value=s.brightness;if(s.volume!=null)$('volume').value=s.volume;
  if(s.vowel)$('vowel').value=s.vowel;if(s.key)$('keySelect').value=s.key;
  if(s.octave)$('octaveSelect').value=s.octave;if(s.scale)$('scaleSelect').value=s.scale;
  if(d.text!=null)$('lyricsEditor').value=d.text;updateLabels();makePiano();$('statusText').textContent="PROJECT OPENED";setLCD("PROJECT LOADED");
 } else {alert("Project opening is available in the desktop app.");}
});
