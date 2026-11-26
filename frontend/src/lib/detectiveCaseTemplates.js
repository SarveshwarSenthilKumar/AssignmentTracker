import {ORIGINAL_DETECTIVE_CASES} from './originalDetectiveCases'
import {CLASSIC_DETECTIVE_CASES} from './classicDetectiveCases'

const cluster=(name,kind,code,notes)=>({name,kind,code,notes,color:'#fff1a8'})

export const DETECTIVE_CASES=[
  {
    id:'gone-girl',title:'Amy Dunne',source:'Gone Girl',year:2014,
    credits:['Novel and screenplay by Gillian Flynn','Directed by David Fincher'],creditUrl:'https://catalog.afi.com/Catalog/moviedetails/70114',code:'DUNNE',accent:'#a28b59',
    description:'A disappearance, an anniversary treasure hunt, and two incompatible versions of a marriage.',
    tags:['Missing person','Unreliable accounts','Staged evidence'],
    center:'AMY DUNNE\n\nA disappearance — or a performance?\n\nSeparate what happened from what was planted.',
    theory:'TWO STORIES\n\nThe diary describes one marriage.\nThe anniversary clues describe another.\nWho controls the evidence?',
    question:'START AGAIN\n\nWhat did Nick actually do?\nWhat was he meant to appear to have done?',
    clusters:[
      cluster('AMY ELLIOTT DUNNE','portrait','01 / AMY',['Missing on the anniversary.\nThe public image is unusually polished.','The diary is evidence of a story.\nIs it evidence of the truth?','Follow preparation, access, and motive.']),
      cluster('NICK DUNNE','portrait','02 / NICK',['His evasions are real.\nThat does not make every accusation true.','The affair changes how everyone reads his behavior.','Separate a bad husband from a murderer.']),
      cluster('THE ANNIVERSARY HUNT','letter','03 / CLUES',['Private memories become directions.\nWho chose the destination?','Every clue appears personal.\nEvery destination also creates an implication.','Track who could place each item.']),
      cluster('THE DIARY','report','04 / DIARY',['A gradual escalation in the written account.\nCheck authorship before chronology.','The entries steer the reader toward one conclusion.','Compare the written marriage with independent accounts.']),
      cluster('THE HOUSE','diagram','05 / SCENE',['The disturbance suggests a struggle.\nDoes its arrangement support one?','Trace the blood, the cleanup, and the staged disorder.','The scene tells a story too neatly.']),
      cluster('THE SHED','receipt','06 / PURCHASES',['Purchases and debts create an apparent motive.\nWho benefits from their discovery?','The treasure hunt leads toward incriminating objects.','A discovery can be staged as carefully as a scene.']),
      cluster('DESI COLLINGS','portrait','07 / DESI',['An old connection offers somewhere to disappear.','The lake house becomes a controlled environment.\nWho controls access?','Compare the return narrative with what happened there.']),
      cluster('THE RETURN','newspaper','08 / PUBLIC STORY',['Amy comes back with an explanation.\nThe audience wants a resolution.','Private knowledge and the public story diverge again.','The case closes publicly.\nDoes that make the story true?'])
    ],
    timeline:['ANNIVERSARY · DISAPPEARANCE','HOUSE · FIRST IMPRESSIONS','DIARY · A SECOND NARRATIVE','CLUES · FOLLOW THE HUNT','SHED · THE DISCOVERY','LAKE HOUSE · DESI','RETURN · THE NEW STORY'],
    timelineNotes:['Who arranged the first impression?','What is staged?','Read as an authored object.','Directions or accusations?','Check who placed the purchases.','Access and surveillance.','Compare each version.'],
    scribbles:['who planted this?','diary ≠ independent witness','check the purchase trail','the audience matters','whose version is this?','private truth / public story','the clue was meant to be found','what did the camera miss?','follow the anniversary route','motive is not proof','compare BOTH accounts','too convenient','who rehearsed this?','check the cleanup','she controls the ending'],
    linkLabel:'TWO ACCOUNTS'
  },
  {
    id:'se7en',title:'The Seven Deadly Sins',source:'Se7en',year:1995,
    credits:['Screenplay by Andrew Kevin Walker','Directed by David Fincher'],creditUrl:'https://catalog.afi.com/Film/60087-SE7EN',code:'SE7EN',accent:'#92764b',
    description:'Somerset and Mills follow a deliberately ordered series of crimes toward a final trap.',
    tags:['Pattern analysis','Seven sins','A constructed ending'],
    center:'SE7EN\n\nThe scenes are a sequence.\nThe sequence is a message.\n\nWho is the final audience?',
    theory:'THE PATTERN\n\nSeven sins.\nResearch, preparation, and control.\n\nThe detectives are being led, not merely followed.',
    question:'THE ENDING IS PART OF IT\n\nWhy surrender before the pattern is complete?\nWho is still missing from the sequence?',
    clusters:[
      cluster('SOMERSET & MILLS','portrait','01 / INVESTIGATORS',['One reads the pattern.\nThe other becomes personally involved.','Somerset follows the literary framework.\nMills follows the suspect.','The investigation itself changes the final outcome.']),
      cluster('GLUTTONY / GREED','report','02 / OPENING',['The first scenes establish the thematic structure.','The labels turn separate crimes into a single authored sequence.','Preparation matters more than opportunity.']),
      cluster('SLOTH','diagram','03 / DURATION',['The discovery reveals sustained preparation.','The apparent end of a trail is another controlled reveal.','The time involved changes the scale of the case.']),
      cluster('THE LIBRARY TRAIL','letter','04 / RESEARCH',['Religious and literary references inform the pattern.','Somerset studies the framework rather than treating the scenes as isolated.','Research becomes an investigative route to the suspect.']),
      cluster('JOHN DOE’S APARTMENT','report','05 / ARCHIVE',['Notebooks, records, and photographs.\nA long-running private system.','The apartment confirms planning, obsession, and observation.','What was documented before the detectives arrived?']),
      cluster('LUST / PRIDE','newspaper','06 / ESCALATION',['The sequence continues while the investigation gains information.','The scenes manipulate interpretation as well as events.','More knowledge has not given the detectives control.']),
      cluster('THE SURRENDER','portrait','07 / DOE',['Doe arrives on his own terms.\nWhy give himself up now?','The offer moves the investigation to a location he selected.','The missing sins have not disappeared from the plan.']),
      cluster('ENVY / WRATH','map','08 / FINAL TRAP',['The last encounter brings the investigators inside the pattern.','Tracy’s fate makes the confrontation personal for Mills.','The final decision is the outcome Doe has engineered.'])
    ],
    timeline:['FIRST SCENE · GLUTTONY','PATTERN · GREED','DISCOVERY · SLOTH','RESEARCH · THE BOOKS','APARTMENT · THE ARCHIVE','SURRENDER · HIS TERMS','FINAL LOCATION · THE TRAP'],
    timelineNotes:['A message is established.','Read the labels together.','A much longer preparation.','Trace the framework.','He has been observing.','Why this moment?','The detectives are now part of the design.'],
    scribbles:['seven, not five','who is choosing the route?','the notebooks matter','the pattern is a script','why surrender NOW?','observer → participant','he controls the location','check the sequence','research is a lead','the last two are different','do not confuse custody with control','who is the audience?','Mills is not outside the case','the ending was prepared','read the labels together'],
    linkLabel:'THE FINAL TWO'
  },
  {
    id:'knives-out',title:'The Thrombey Estate',source:'Knives Out',year:2019,
    credits:['Written and directed by Rian Johnson'],creditUrl:'https://app.powster.com/lionsgateus/knives-out/us/synopsis/',code:'THROMBEY',accent:'#8b775e',
    description:'An apparent suicide, a disputed inheritance, and a medication story that depends on reading the wrong labels.',
    tags:['Inheritance','Medication evidence','A false premise'],
    center:'HARLAN THROMBEY\n\nThe family has motives.\nThe medication has labels.\n\nWhich story depends on a false assumption?',
    theory:'START WITH THE MEDICINE\n\nMarta knows the drugs by handling them.\nThe labels tell a different story.\nWhat does the blood test say?',
    question:'THE WRONG CRIME?\n\nA plan can fail before anyone knows it failed.\nFollow the attempted cover-up.',
    clusters:[
      cluster('HARLAN THROMBEY','portrait','01 / HARLAN',['The death follows the family gathering.','Harlan acts on what he believes happened with the medication.','Separate his belief from the medical evidence.']),
      cluster('MARTA CABRERA','portrait','02 / MARTA',['The nurse fears she made a fatal mistake.','Her familiarity with the medication matters more than the labels.','Her account is incomplete without the toxicology result.']),
      cluster('THE FAMILY','report','03 / INHERITANCE',['Each relative presents a version of their relationship with Harlan.','The will changes who stands to gain.','Financial motives are plentiful.\nEvidence still has to connect them.']),
      cluster('THE MEDICAL BAG','diagram','04 / VIALS',['Compare the contents, the labels, and what Marta actually administered.','The missing antidote suggests advance interference.','The presumed overdose is the investigation’s central assumption.']),
      cluster('RANSOM','portrait','05 / RANSOM',['He knows more about the inheritance than his helpful manner suggests.','Track access to the medical bag and the testing process.','Helping someone conceal evidence can create leverage.']),
      cluster('FRAN','letter','06 / FRAN',['Fran’s knowledge creates another trail.','Her message is interpreted through the existing medication story.','Ask what she saw, and who needed her silenced.']),
      cluster('THE TOXICOLOGY REPORT','report','07 / BLOOD TEST',['The test challenges the supposed fatal medication error.','A destroyed record matters because of what it could disprove.','The original premise of the cover-up is wrong.']),
      cluster('BLANC’S RECONSTRUCTION','newspaper','08 / RECONSTRUCTION',['Rebuild the sequence around the actual medicine, not its labels.','The failed plan and the later cover-up leave different evidence.','Marta’s response helps expose the person still manipulating the story.'])
    ],
    timeline:['FAMILY GATHERING','MEDICATION · THE ASSUMPTION','HARLAN · A FATAL DECISION','THE WILL · MOTIVES CHANGE','FRAN · ANOTHER TRAIL','TOXICOLOGY · THE CONTRADICTION','RECONSTRUCTION · THE FAILED PLAN'],
    timelineNotes:['Compare the accounts.','Labels are not contents.','What did he believe?','Who already knew?','What was she trying to say?','Read the medical result.','Separate the attempt from its aftermath.'],
    scribbles:['labels ≠ contents','check the blood test','who had access to the bag?','the will changes everything','why destroy this record?','what did Fran see?','the helpful person has leverage','the premise is WRONG','follow the missing antidote','compare belief with evidence','who knew about the inheritance?','reconstruct the attempt','Marta knows the medicine','the cover-up leaves a second trail','ask what actually caused the death'],
    linkLabel:'LABELS vs CONTENTS'
  },
  ...CLASSIC_DETECTIVE_CASES,
  {id:'meridian',title:'The Meridian Signal',source:'Original fictional case',code:'M-47',accent:'#648477',description:'Eight locations, contradictory records, and seventeen missing minutes. An original mystery with a new messy layout each time.',tags:['Original mystery','Coded signals','Missing interval']},
  ...ORIGINAL_DETECTIVE_CASES
]
