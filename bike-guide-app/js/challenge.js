import { db } from './firebase-config.js';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { isPremium } from './app.js';

const CHALLENGE_PLAN = [
  // Week 1 — Build Base
  { day:1,  title:'Easy 20-Min Spin',            desc:'Ride on flat ground in the easiest gear. Focus on smooth cadence, not speed.', duration:'20 min', distance:'5–8 km',  drills:['Stay in Ring 2, Cog 4–5','Keep cadence around 70 RPM','Smile — you started!'] },
  { day:2,  title:'Rest & Stretch Day',           desc:'Active recovery. Do the cool-down routine in the app. Let your muscles adapt.', duration:'15 min', distance:'Rest',   drills:['Full cool-down routine','Hydrate well','Log how your body feels'] },
  { day:3,  title:'25-Min Endurance Ride',        desc:'Maintain a conversational pace — you should be able to talk while riding.', duration:'25 min', distance:'6–10 km', drills:['Practice gear shifts on flats','Notice how gears affect effort','Drink water at halfway'] },
  { day:4,  title:'Gear Practice Drill',          desc:'Ride a flat route and deliberately shift through all your gears. Feel each one.', duration:'20 min', distance:'5–8 km',  drills:['Shift front ring 1→2→3 and back','Shift rear cog 1→7 and back','Identify your "comfort zone" gear'] },
  { day:5,  title:'30-Min Steady Ride',           desc:'Longest ride so far. Maintain steady pace. No rushing.', duration:'30 min', distance:'8–12 km', drills:['Start slow, finish steady','Shift down before uphills','Track your distance'] },
  { day:6,  title:'Rest & Nutrition Day',         desc:'Read the Diet section in the app. Plan your pre-ride meal for tomorrow.', duration:'Rest',   distance:'Rest',    drills:['Read diet module','Plan tomorrow\'s pre-ride meal','Check tire pressure for tomorrow'] },
  { day:7,  title:'Weekend Exploration Ride',     desc:'Ride somewhere new! A park, riverside path, or any safe route you haven\'t tried.', duration:'35 min', distance:'10–15 km', drills:['Explore a new route','Practice emergency stops in a safe spot','Take a photo of your ride'] },
  // Week 2 — Build Confidence
  { day:8,  title:'Morning Spin (Fasted)',        desc:'Ride before breakfast for fat adaptation training. Keep intensity very low.', duration:'25 min', distance:'6–10 km',  drills:['Very easy effort only','Bring water and a banana','Don\'t push hard on an empty stomach'] },
  { day:9,  title:'Hill Introduction',            desc:'Find a gentle uphill. Practice shifting down before the climb. Ride up and back 3 times.', duration:'30 min', distance:'8–12 km',  drills:['Shift to Ring 1 before the hill','Stay seated on climbs','Build mental toughness'] },
  { day:10, title:'Rest Day',                     desc:'You completed your first 9 days! Rest, reflect, and recharge.', duration:'Rest',   distance:'Rest',    drills:['Log your feelings','Review your progress stats','Plan next week\'s rides'] },
  { day:11, title:'Cadence Drills',               desc:'Ride focusing ONLY on high cadence (80–90 RPM). Use easier gears to spin faster.', duration:'30 min', distance:'8–12 km',  drills:['Target 80–90 RPM throughout','Shift to maintain cadence on changes','Feel the difference vs. mashing'] },
  { day:12, title:'40-Min Endurance Ride',        desc:'Comfortable long ride. Bring a snack for after. Track your total distance.', duration:'40 min', distance:'12–18 km', drills:['Steady effort throughout','Fuel with banana/coconut water','Practice smooth braking'] },
  { day:13, title:'Maintenance Practice Day',     desc:'After your ride, practice cleaning and lubing your chain. Check all bolts.', duration:'25 min', distance:'6–10 km',  drills:['Post-ride: clean chain','Check brake pad thickness','Inspect tires for cuts'] },
  { day:14, title:'Group Ride Attempt',           desc:'Join a local bike group or ride with a friend. Group riding teaches bike handling.', duration:'45 min', distance:'15–20 km', drills:['Ride with others for the first time','Signal turns and stops','Learn group etiquette'] },
  // Week 3 — Push Forward
  { day:15, title:'45-Min Tempo Ride',            desc:'Ride at a pace where you\'re working hard but can still speak in short sentences.', duration:'45 min', distance:'15–20 km', drills:['Work at 70% effort','Use Ring 2 + Cog 3–5','Feel the burn — you\'re getting stronger!'] },
  { day:16, title:'Hill Repeat Training',         desc:'Find a hill and ride up 5 times. Rest between each climb.', duration:'45 min', distance:'12–18 km', drills:['5 hill repeats with rest','Focus on consistent power','Track your best hill time'], premium:true },
  { day:17, title:'Recovery Spin',               desc:'Very easy ride the day after hard training. Flush out lactic acid.', duration:'25 min', distance:'6–10 km',  drills:['Very low effort — Zone 1','Breathe deeply and relax','Do the warm-up routine first'], premium:true },
  { day:18, title:'Long Endurance Ride',          desc:'Your longest ride yet. Bring extra water and a snack. Pace yourself from the start.', duration:'60 min', distance:'20–28 km', drills:['Start 20% slower than you think you should','Fuel every 45 minutes','Cool down properly after'], premium:true },
  { day:19, title:'Technical Skills Day',         desc:'Practice tight cornering, slow-speed balance, and emergency braking.', duration:'30 min', distance:'8–12 km',  drills:['Slow-speed balance drills','Emergency brake stops (safe area)','Figure-8 cornering practice'], premium:true },
  { day:20, title:'Rest Day',                     desc:'Halfway through! Take a proper rest. Reflect on how much you\'ve already improved.', duration:'Rest',   distance:'Rest',    drills:['Full rest','Journal your progress','Review your ride tracker stats'], premium:true },
  { day:21, title:'Interval Training Intro',      desc:'Alternate 2 minutes fast with 3 minutes easy for the entire ride.', duration:'40 min', distance:'12–18 km', drills:['2 min hard / 3 min easy × 6 sets','Hard = 85% effort','Easy = recovery spin'], premium:true },
  // Week 4 — Peak Week
  { day:22, title:'60-Min Steady State',          desc:'One full hour at a comfortable but purposeful pace.', duration:'60 min', distance:'20–28 km', drills:['Maintain consistent effort','Shift smoothly as terrain changes','Beat last week\'s distance'], premium:true },
  { day:23, title:'Hill Climb Challenge',         desc:'Find your biggest accessible hill. Ride to the top without stopping.', duration:'50 min', distance:'15–20 km', drills:['Commit to not stopping on the climb','Shift to Ring 1 early','Celebrate at the top!'], premium:true },
  { day:24, title:'Speed Session',               desc:'Flat road sprints. 10 seconds full effort, 90 seconds recovery × 8 sets.', duration:'40 min', distance:'12–16 km', drills:['10-sec full sprint × 8','90-sec easy recovery between','Warm up 10 min first'], premium:true },
  { day:25, title:'Rest Day',                     desc:'Final week preparation. Rest, eat well, hydrate.', duration:'Rest',   distance:'Rest',    drills:['Full rest','Prepare gear for the final push','Visualize completing Day 30'], premium:true },
  { day:26, title:'75-Min Endurance Ride',        desc:'Your longest ride in the challenge. Fuel properly and trust your training.', duration:'75 min', distance:'25–35 km', drills:['Longest ride of the challenge','Eat before, snack during, eat after','You\'ve earned this one!'], premium:true },
  { day:27, title:'Active Recovery',              desc:'Easy spin + full warm-up/cool-down routine. Let your body prepare for the final push.', duration:'30 min', distance:'8–12 km',  drills:['Easy spin + full stretching routine','Hydrate extra today','Sleep well tonight'], premium:true },
  { day:28, title:'Penultimate Hard Ride',        desc:'One last hard session. Intervals + hill climb combo.', duration:'60 min', distance:'18–25 km', drills:['3 hill repeats + 4 intervals','Push yourself — finish strong','One more day after this!'], premium:true },
  { day:29, title:'Rest & Reflect',              desc:'Tomorrow is your graduation ride. Rest today. You\'ve worked incredibly hard.', duration:'Rest',   distance:'Rest',    drills:['Full rest','Plan your graduation route for Day 30','Share your progress online!'], premium:true },
  { day:30, title:'🏆 Graduation Ride!',          desc:'You did it! Ride your favorite route and celebrate completing 30 days. You are a cyclist now.', duration:'60+ min', distance:'Your choice!', drills:['Ride your favorite route','Take photos and share','Tag #BikeGuidePH and inspire others!'], premium:true },
];

export { CHALLENGE_PLAN };

export async function getDayStatus() {
  const userId = localStorage.getItem('bikeUserId');
  if (!userId) return {};
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'challenge'));
    const status = {};
    snap.forEach(d => { status[d.id] = d.data(); });
    return status;
  } catch { return {}; }
}

export async function markDayComplete(day) {
  const userId = localStorage.getItem('bikeUserId');
  if (!userId) return;
  await setDoc(doc(db, 'users', userId, 'challenge', `day_${String(day).padStart(2,'0')}`), {
    day,
    completed: true,
    completedAt: serverTimestamp(),
  });
}

export function getStreakCount(status) {
  let streak = 0;
  for (let d = 1; d <= 30; d++) {
    const key = `day_${String(d).padStart(2,'0')}`;
    if (status[key]?.completed) streak++;
    else break;
  }
  return streak;
}
