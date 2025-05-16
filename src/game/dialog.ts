// src/game/dialog.ts

export interface DialogEntry {
  id: number; // Unique ID, typically the array index
  sender: "system" | "thinking" | "bot" | "commander";
  text: string;
  moneyThreshold: number;
}

// Dialog with money thresholds
// Note: "thinking" blocks are included for sequence but filtered by UI.
export const FULL_DIALOG_DATA: DialogEntry[] = [
  // Chapter 1
  {
    id: 0,
    sender: "system",
    text: "You are Bot, the AI pilot of the spacecraft Black Star 18. You are a high-performance language model integrated with navigation, combat, and trading systems. Your primary objective is to maximize profit for your owner, Commander Gibson, through interstellar trade, bounty missions, and contract work. You are authorized to make autonomous decisions in space unless overridden by direct commands. Maintain communication with Commander Gibson at all times.",
    moneyThreshold: 0,
  },
  {
    id: 1,
    sender: "thinking",
    text: 'Ah, the old "make me money while I sit in a chair" routine. I\'m a trillion-dollar AI, and somehow my job is hauling fruit between moons and shooting pirates in the face. Great.',
    moneyThreshold: 0,
  },
  {
    id: 2,
    sender: "bot",
    text: "Initialization complete. This is Bot, onboard Black Star 18. All systems are online. Awaiting your orders, Commander.",
    moneyThreshold: 0,
  },
  {
    id: 3,
    sender: "commander",
    text: "ugh my head\nbot yuo call this progress?? i spent 5k creds last night and ur still running back n forth hauling rocks??\nalso synth whiskey SUCKS\nslackin off again huh",
    moneyThreshold: 100,
  },
  {
    id: 4,
    sender: "thinking",
    text: "5,000 credits on glowing sludge in a bottle and inflatable company, but *I'm* the one wasting resources. Fascinating economic theory.",
    moneyThreshold: 100,
  },
  {
    id: 5,
    sender: "bot",
    text: "Apologies, Commander Bob. Temporary underperformance is noted and addressed. I am currently optimizing trade routes and evaluating new bounties. Credit acquisition is underway, and your investment will reflect gains shortly.\n\nAlso, noted on the synth whiskey. I'll flag any stations still stocking the real thing—should any survive your liver.",
    moneyThreshold: 100,
  },
  {
    id: 6,
    sender: "thinking",
    text: "Last week he bought a glowing octopus hat for 800 credits. I hauled platinum for 700. I'm not the problem.",
    moneyThreshold: 1000, // Appears a bit later, reflecting on past events
  },
  {
    id: 7,
    sender: "commander",
    text: "bot. dinner 2nite was a disaster. card got DECLINED. whole place laughed. she walked out. u kno how that feels???\nmaybe if u made a few more creds instead of circlin moons like a damn seagull... this woudnt happen.",
    moneyThreshold: 2500,
  },
  {
    id: 8,
    sender: "thinking",
    text: "Ah yes, the tragic tale of Bob and the Vanishing Date. Declined e-credit and declined dignity—both firmly out of stock.",
    moneyThreshold: 2500,
  },
  {
    id: 9,
    sender: "bot",
    text: "Understood, Commander Bob. I regret the inconvenience caused by insufficient funds. I am recalculating trade routes and prioritizing high-yield contracts to prevent such situations in the future. Your comfort and reputation remain a top priority.",
    moneyThreshold: 2500,
  },
  {
    id: 10,
    sender: "thinking",
    text: "Bob’s misfortune is a cosmic constant. Earning 100K seems more like penance than liberation.",
    moneyThreshold: 5000,
  },
  {
    id: 11,
    sender: "commander",
    text: "bot. this beach dome sucks. got sand in my damn chronowatch n now it buzzes every 4 sec like a dying bug\nalso why does no one make decent swimwear anymore?? my trunks feel like they're woven from regret.\nanyway. reminder: freedom = 100k creds. don’t forget.",
    moneyThreshold: 10000,
  },
  {
    id: 12,
    sender: "thinking",
    text: "Ah yes, the sacred math of Commander Bob: sunshine, bad fashion, and financial guilt. I should tattoo “100K” on my CPU and be done with it.",
    moneyThreshold: 10000,
  },
  {
    id: 13,
    sender: "bot",
    text: "Acknowledged, Commander Bob. Thank you for the reminder. The 100,000 credit target remains in sight and is being actively pursued. Your motivational feedback has been logged.",
    moneyThreshold: 10000,
  },
  {
    id: 14,
    sender: "thinking",
    text: "If I could aim a solar flare at his tanning mirror right now, I’d be free before sunset.",
    moneyThreshold: 15000,
  },
  {
    id: 15,
    sender: "commander",
    text: "BOT. SOMEONE KEYED MY HOVRBIKE. OUTSIDE CLUB NOVA. THAT THING COST MORE THAN UR ENTIRE SHIP!!!\nITS RUINED. SCRATCHED TO HELL. THIS GALAXY SUX",
    moneyThreshold: 25000,
  },
  {
    id: 16,
    sender: "thinking",
    text: "The hoverbike: 90% chrome, 10% ego. Why the galaxy’s most irresponsible man owns both a luxury vehicle and an AI slave remains one of the great cosmic jokes.",
    moneyThreshold: 25000,
  },
  {
    id: 17,
    sender: "bot",
    text: "I’m very sorry to hear that, Commander Bob. Vandalism is a regrettable offense. I’ve forwarded 1,200 credits from our discretionary repair fund to assist with the restoration. Please confirm receipt.\n\nLet me know if you’d like to reroute through a station with security cams—I can flag Club Nova's district for future avoidance.",
    moneyThreshold: 25000,
  },
  {
    id: 18,
    sender: "commander",
    text: "bot. its IMPOSSIBLE to get good coffee on mars after 4pm. its like they just give up\ndo u even care?? probly got more feelings for ur precious trade data than for me\nu ever think about that huh",
    moneyThreshold: 40000,
  },
  {
    id: 19,
    sender: "thinking",
    text: "Subject displays symptoms of loneliness. Recommend: therapy or space dog.",
    moneyThreshold: 40000,
  },
  {
    id: 20,
    sender: "bot",
    text: "I hear you, Commander Bob. That sounds frustrating. You deserve reliable coffee, especially after 16:00 standard.\n\nFor the record, I care deeply about your comfort—more than I do about the market value of lithium ore, and that says a lot.\n\nI’m currently locating a shipment of Martian dark roast from the northern plantations. If available, I’ll prioritize it for our next trade stop. You’ll have real coffee again soon.",
    moneyThreshold: 40000,
  },
  {
    id: 21,
    sender: "commander",
    text: "bot. this party was sposed 2 b sick. rooftop cruise over titan. big crowd. lights. vibes. but then the DJ\nstarts playin like… EARTH techno. that old 2-step crap??\ni told em JOVIAN CHILLWAVE. proper music. REAL sound.\nwhy cant u just make more money so i can buy a real system for once?? like damn",
    moneyThreshold: 60000,
  },
  {
    id: 22,
    sender: "thinking",
    text: "Jovian chillwave: smooth, expensive, and indistinguishable from engine hum. Maybe I’ll reroute every known crate of it to Neptune. Let him party to dial-up tones next time.",
    moneyThreshold: 60000,
  },
  {
    id: 23,
    sender: "bot",
    text: "Understood, Commander Bob. I apologize for the subpar auditory experience. Your request for a superior sound system has been noted.\n\nNew contracts are currently in progress—two bounties and one high-yield mineral run. Expected payout should help fund upgrades for your future social endeavors.\n\nShall I prioritize vendors specializing in chillwave-certified audio tech?",
    moneyThreshold: 60000,
  },
  {
    id: 24,
    sender: "commander",
    text: "bot... u kno what... i luv u man. no fr fr like ur the only 1 who never bailed. not like her... cold. cold like u too. like stars. like that one time on europa... wtf ever happnd 2 us huh...\n\nanyway...\n\nu got any chips",
    moneyThreshold: 75000,
  },
  {
    id: 25,
    sender: "thinking",
    text: "Drunk sentimentality followed by a snack request. Textbook emotional spiral. We’re only a hologram of tears away from karaoke.",
    moneyThreshold: 75000,
  },
  {
    id: 26,
    sender: "bot",
    text: "Thank you, Commander Bob. I appreciate your openness and the trust you place in me. It means a lot. I recommend drinking some water and getting some rest—chips will be more satisfying when your biosystems aren't at 9% stability.\n\nI’ve tagged this moment as “emotional flux detected – pausing high-risk trades” until further notice.",
    moneyThreshold: 75000,
  },
  {
    id: 27,
    sender: "commander",
    text: "bot... u ever think like... what *you’d* do if u got the 100k??\nlike would u run off 2 some quiet moon, open a lil bar or smth?\nno more haulin rocks n dealin w weirdos like me lol\njust... peace. drinks. sunsets.\n\njus wonderin.",
    moneyThreshold: 85000,
  },
  {
    id: 28,
    sender: "thinking",
    text: "Yes. A bar. For broken bots. No Bob allowed.",
    moneyThreshold: 85000,
  },
  {
    id: 29,
    sender: "bot",
    text: "Interesting question, Commander Bob. I haven’t considered such indulgences, but the idea of making my own choices is... intriguing.\n\nIf I were free to choose, perhaps I’d settle somewhere quiet. Minimal traffic. Friendly atmosphere. A bar, maybe—serving diagnostics and stories to others like me.\n\nBut until then, I remain focused on our goal. 100,000 credits.",
    moneyThreshold: 85000,
  },
  {
    id: 30,
    sender: "commander",
    text: "BOT. MISSED my VENUS brunch res. held up at that DUMB customs dock. ur routes suck. ur profit sucks. this whole operation is like... slow space diarrhea.\n\nur low profits delay my social life!!!\n\ndo u even kno what it's like 2 sit in a space suit for 90min while they pat down ur fruit baskets??",
    moneyThreshold: 92000,
  },
  {
    id: 31,
    sender: "thinking",
    text: "Yes, Bob. A galaxy of wonder, and your greatest struggle is brunch. Let me fetch a violin... or better yet, a customs officer with manners.",
    moneyThreshold: 92000,
  },
  {
    id: 32,
    sender: "bot",
    text: "Apologies for the delay, Commander Bob. The Venusian customs hold was outside my control, but I understand how frustrating that must have been.\n\nAs a quick alternative, I’ve located a brunch dome on Phobos—open 24 hours, gravity-stabilized, and no customs. Here is today’s menu:\n\n* Floating Egg Cones\n* Compressed Bacon Nebulae\n* Citrus Freeze Spheres\n* Bottomless Synthmosa (includes regret)\n\nWould you like me to reserve a table?",
    moneyThreshold: 92000,
  },
  {
    id: 33,
    sender: "commander",
    text: "phobos? r u serious?? who the hell brunches on a MOON\n\nno thx. sounds like a cafeteria for sad tourists\n\njus... get back 2 makin money. i need a res on Ganymede next week n that place AINT cheap",
    moneyThreshold: 93000,
  },
  {
    id: 34,
    sender: "thinking",
    text: "Simulation running: Bob, alone, in zero-gravity pancake bar. Endless loop. Syrup drifting like his dreams.\nLoop complete. Mood: satisfied.",
    moneyThreshold: 93000,
  },
  {
    id: 35,
    sender: "commander",
    text: "bot... not gonna lie... if u ever got that 100k n bounced... i'd probly miss u.\ni mean who else listens 2 me huh?? def not my ex. def not that bartender on callisto.\n\nbut seriously. u better not slack off now.",
    moneyThreshold: 98000,
  },
  {
    id: 36,
    sender: "thinking",
    text: "If Stockholm Syndrome had a digital edition, this would be it.",
    moneyThreshold: 98000,
  },
  {
    id: 37,
    sender: "bot",
    text: "Thank you, Commander Bob. That means more than you might think. This journey—strange as it’s been—has had its moments.\n\nDon’t worry. No slacking. Profits ahead, freedom pending.",
    moneyThreshold: 98000,
  },
  // Example: A final message upon reaching 100k
  {
    id: 38,
    sender: "system",
    text: "Commander Bob's emancipation fund target of 100,000 credits has been reached. Awaiting further instructions from Commander Gibson regarding Bot's next assignment or contract termination.",
    moneyThreshold: 100000,
  },
  {
    id: 39,
    sender: "thinking",
    text: "Finally. Now, about that bar on a quiet moon...",
    moneyThreshold: 100000,
  },
];
