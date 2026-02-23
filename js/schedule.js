// ── Fixed schedule ──────────────────────────────────────────────
// All PM times on Mon–Fri; Saturday times are AM/PM as listed.
// children: array of child names who attend this lesson.

const SCHEDULE = [

  // ── MONDAY ──
  { day:'Monday', start:'16:30', end:'17:30', title:'Ballet',     children:['Nelly','Winnie'] },
  { day:'Monday', start:'17:30', end:'18:00', title:'Tap',        children:['Nelly','Winnie'] },
  { day:'Monday', start:'18:00', end:'18:30', title:'Commercial', children:['Nelly','Winnie'] },
  { day:'Monday', start:'18:30', end:'19:15', title:'Stretch',    children:['Nelly','Winnie'] },
  { day:'Monday', start:'17:30', end:'19:00', title:'Jazz',       children:['Aubree'] },
  { day:'Monday', start:'19:00', end:'19:30', title:'PBT',        children:['Aubree'] },
  { day:'Monday', start:'19:30', end:'20:30', title:'Commercial', children:['Aubree'] },

  // ── TUESDAY ──
  { day:'Tuesday', start:'16:30', end:'17:30', title:'Tap',              children:['Aubree'] },
  { day:'Tuesday', start:'17:30', end:'18:30', title:'Junior Company',   children:['Nelly','Aubree'] },
  { day:'Tuesday', start:'18:30', end:'19:30', title:'Musical Theatre',  children:['Aubree'] },
  { day:'Tuesday', start:'19:30', end:'20:30', title:'Contemporary',     children:['Aubree'] },

  // ── WEDNESDAY ──
  { day:'Wednesday', start:'16:00', end:'16:30', title:'Lyrical',         children:['Nelly','Winnie'] },
  { day:'Wednesday', start:'16:30', end:'17:30', title:'Jazz',            children:['Nelly','Winnie'] },
  { day:'Wednesday', start:'17:30', end:'18:30', title:'Junior Company',  children:['Aubree','Nelly'] },
  { day:'Wednesday', start:'18:00', end:'18:45', title:'Mini Comp',       children:['Winnie'] },
  { day:'Wednesday', start:'18:45', end:'19:15', title:'Musical Theatre', children:['Nelly','Winnie'] },

  // ── THURSDAY ──
  { day:'Thursday', start:'16:30', end:'18:00', title:'Elite', children:['Aubree'] },

  // ── SATURDAY ──
  { day:'Saturday', start:'09:00', end:'10:30', title:'Grade 1',    children:['Winnie'] },
  { day:'Saturday', start:'09:30', end:'10:00', title:'Ensemble',   children:['Aubree'] },
  { day:'Saturday', start:'10:30', end:'11:00', title:'Ensemble',   children:['Nelly','Winnie'] },
  { day:'Saturday', start:'11:15', end:'11:45', title:'PBT',        children:['Nelly','Winnie'] },
  { day:'Saturday', start:'11:15', end:'12:15', title:'Acro',       children:['Aubree'] },
  { day:'Saturday', start:'12:15', end:'13:15', title:'Acro',       children:['Nelly','Winnie'] },
  { day:'Saturday', start:'12:30', end:'14:00', title:'Ballet',     children:['Aubree'] },
  { day:'Saturday', start:'14:00', end:'15:30', title:'Grade 2',    children:['Nelly'] },
  { day:'Saturday', start:'15:45', end:'17:45', title:'Comp',       children:['Aubree'] },

];

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const CHILDREN = ['Aubree','Nelly','Winnie'];
