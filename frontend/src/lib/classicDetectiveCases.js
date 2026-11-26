const clue=(name,kind,code,...notes)=>({name,kind,code,notes,color:'#fff1a8'})

export const CLASSIC_DETECTIVE_CASES=[
  {
    id:'baskerville-hound',title:'The Baskerville Hound',source:'The Hound of the Baskervilles',year:1902,
    credits:['Novel by Arthur Conan Doyle'],creditUrl:'https://www.gutenberg.org/ebooks/3070',code:'HB-02',accent:'#64785d',
    description:'Holmes and Watson weigh a family legend against footprints, a warning letter, and activity on the moor.',
    tags:['Sherlock Holmes','Family legend','Moorland clues'],
    center:'THE BASKERVILLE HOUND\n\nSir Charles died near the grounds of the hall.\nWhich details come from witnesses, and which come from the family legend?',
    theory:'A WARNING AND A MISSING BOOT\n\nPut the two London incidents beside the reports from Devon.\nWhich actions suggest someone was tracking Sir Henry?',
    question:'THE MOOR AT NIGHT\n\nCompare the sightlines, the mistaken identity, and what the witnesses could actually see.',
    clusters:[
      clue('FAMILY MANUSCRIPT','letter','01 / LEGEND','The manuscript explains why the family fears a hound.','Its age is separate from its reliability.','Mark the claims that later witnesses repeat.'),
      clue('DR. MORTIMER','portrait','02 / REPORT','Mortimer describes the scene and an unusual footprint.','Separate what he saw from what he concluded.','Compare the reported track with the path through the grounds.'),
      clue('LONDON WARNING','letter','03 / WARNING','Sir Henry receives a warning before traveling to Devon.','The message suggests someone knows his plans.','Ask whether the sender and the person following him have the same motive.'),
      clue('HOTEL BOOTS','receipt','04 / BOOTS','A boot goes missing from the hotel.','The details of which boot matters more than its price.','Cross-reference the missing clothing with the later mix-up.'),
      clue('BASKERVILLE HALL','diagram','05 / HALL','A light appears at an upstairs window.','Watson observes a signaling pattern.','The signal is a clue to a separate secret in the household.'),
      clue('THE MOOR','map','06 / MOOR','Paths, sightlines, and hiding places change what each witness can see.','Keep the escaped prisoner and the hound reports on separate threads.','Track which observations took place in fog or darkness.'),
      clue('STAPLETON HOUSEHOLD','portrait','07 / HOUSEHOLD','Compare the relationship they claim with later testimony.','Look for a connection to the Baskerville family.','Treat the portrait as a lead to check against family records.'),
      clue('FINAL OBSERVATIONS','report','08 / CHECK','The last encounter gives the investigators direct evidence.','Separate the apparent supernatural effect from its physical source.','Revisit the earlier sightings with that distinction in mind.')
    ],
    timeline:['SIR CHARLES · DEATH REPORTED','MORTIMER · CONSULTATION','LONDON · WARNING ARRIVES','SIR HENRY · ARRIVES IN DEVON','WATSON · OBSERVES THE MOOR','PORTRAIT · FAMILY LINK','FINAL NIGHT · THEORY TESTED'],
    timelineNotes:['Record the scene before reading the legend.','Separate the reported facts.','Who knew the travel plan?','Watch for recurring objects.','Several investigations overlap.','Check the likeness against records.','Compare direct evidence with hearsay.'],
    scribbles:['separate legend from evidence','track the boot','two reasons for a signal','who benefits from the inheritance?','check the sightline','revisit the portrait'],
    linkLabel:'LEGEND OR EVIDENCE'
  },
  {
    id:'orient-express',title:'The Snowbound Carriage',source:'Murder on the Orient Express',year:1934,
    credits:['Novel by Agatha Christie'],creditUrl:'https://www.agathachristie.com/en/stories/murder-on-the-orient-express',code:'OE-34',accent:'#91754e',
    description:'Poirot compares a snowbound train’s passenger list, witness accounts, and seemingly incompatible clues.',
    tags:['Hercule Poirot','Closed circle','Conflicting alibis'],
    center:'THE SNOWBOUND CARRIAGE\n\nA passenger dies after the train stops in snow.\nBuild a timeline from observations before interpreting the alibis.',
    theory:'THE PASSENGER LIST\n\nCompare each claimed background with what Poirot learns about the Armstrong household.',
    question:'TWO EXPLANATIONS\n\nWhich account requires the fewest coincidental clues?\nWhich details would distinguish the competing theories?',
    clusters:[
      clue('THE STOPPED TRAIN','map','01 / ROUTE','Snow stops the journey overnight.','Check when the route stopped offering a way off the train.','Separate transport times from witness estimates.'),
      clue('RATCHETT’S COMPARTMENT','diagram','02 / SCENE','Log who entered after the death was discovered.','Keep the window, lock and adjoining spaces on separate lines.','An apparent route is not proof it was used.'),
      clue('THE PASSENGER LIST','report','03 / LIST','The carriage has an unusually full roster.','Compare the names on tickets with the accounts later given.','Mark each known connection before assuming strangers are unrelated.'),
      clue('THE WATCH','receipt','04 / TIME','The watch supplies a precise reading.','Precision does not settle whether the reading is reliable.','Compare the reading with independent observations.'),
      clue('THE LETTER FRAGMENT','letter','05 / ARMSTRONG','A fragment points toward an older case.','It gives Poirot a new way to group the witnesses.','Track which claimed histories it calls into question.'),
      clue('THE CONDUCTOR','portrait','06 / UNIFORM','A sighting may identify a uniform without identifying its wearer.','Compare the conductor’s route with the stated witness positions.','Keep identification and timing as separate claims.'),
      clue('WITNESS ACCOUNTS','report','07 / ACCOUNTS','Several alibis depend on other people in the same carriage.','Mark which statements are independently corroborated.','Check whether contradictions could be deliberate.'),
      clue('POIROT’S TWO THEORIES','report','08 / REVIEW','Compare the outsider explanation with a shared motive.','Ask which clues fit either explanation.','Keep the evidence separate from the final decision about what to report.')
    ],
    timeline:['DEPARTURE · PASSENGERS BOARD','OVERNIGHT · SNOW STOPS TRAIN','NIGHT · WITNESSES HEAR MOVEMENT','MORNING · DEATH DISCOVERED','FRAGMENT · ARMSTRONG LEAD','INTERVIEWS · ALIBIS COMPARED','REVIEW · TWO THEORIES'],
    timelineNotes:['Start with the passenger list.','Check the physical boundaries.','Mark whose time estimate you used.','Separate scene clues from later discoveries.','Cross-reference the old case.','Who corroborates whom?','Which facts genuinely decide between theories?'],
    scribbles:['a watch can mislead','check independent alibis','draw the carriage','uniform ≠ identity','compare the roster','two explanations, one evidence list'],
    linkLabel:'COMPARE THE ALIBIS'
  },
  {
    id:'prestige',title:'The Rival Magicians',source:'The Prestige',year:2006,
    credits:['Directed by Christopher Nolan','Screenplay by Jonathan Nolan and Christopher Nolan','Novel by Christopher Priest'],
    creditUrl:'https://catalog.afi.com/Catalog/MovieDetails/63992',code:'TP-06',accent:'#866e90',
    description:'Two rivals leave behind performances, diaries, and testimony that tell different stories about the same trick.',
    tags:['Rival magicians','Unreliable journals','Stage illusions'],
    center:'THE RIVAL MAGICIANS\n\nTwo acts create a similar effect.\nTrace each performance separately before assuming they use the same method.',
    theory:'WHO WAS MEANT TO READ THE JOURNAL?\n\nA private-looking record can be written for a rival.\nTrack the intended reader and compare it with independent evidence.',
    question:'ONSTAGE AND BACKSTAGE\n\nWhat was visible to the audience, and what would a stagehand or witness have been able to verify?',
    clusters:[
      clue('ANGIER','portrait','01 / ANGIER','Angier becomes fixated on matching the effect.','Track the difference between his public act and what the staff see.','Ask when rivalry starts steering his interpretation.'),
      clue('BORDEN','portrait','02 / BORDEN','Borden guards his method even outside the theater.','Compare apparently conflicting accounts of his behavior.','Look for evidence that does not depend on his journal.'),
      clue('THE TRANSPORTED MAN','diagram','03 / STAGE','The audience sees a disappearance and a reappearance.','Map the visible positions and mark the unseen spaces.','Do not assume acts producing the same effect share a method.'),
      clue('THE NOTEBOOKS','letter','04 / JOURNALS','Both journals are read under unusual circumstances.','Highlight who gains if a particular entry is believed.','Separate recorded events from instructions directed at the reader.'),
      clue('CUTTER','portrait','05 / CUTTER','Cutter knows how audiences follow a performance.','List which backstage observations he can confirm.','Mark when his perspective is limited by where he stands.'),
      clue('COLORADO SPRINGS','map','06 / TESLA','Angier follows a notebook trail to Tesla.','The trip is an event even if the clue’s original meaning was misleading.','Compare what he went looking for with what he returned with.'),
      clue('THE COURT RECORD','report','07 / TRIAL','The trial depends on a witness’s view of a backstage event.','Reconstruct the sightline before interpreting intent.','Keep the physical evidence separate from the prosecution’s account.'),
      clue('FINAL RECONSTRUCTION','report','08 / RECONSTRUCTION','Make one timeline for each performer.','Look for facts that resolve their apparent contradictions.','Keep the two explanations distinct even where the performances look alike.')
    ],
    timeline:['EARLY ACTS · RIVALS WORK TOGETHER','ACCIDENT · RIVALRY DEEPENS','STAGE · THE NEW EFFECT','JOURNAL · A LEAD APPEARS','COLORADO · LEAD FOLLOWED','TRIAL · BACKSTAGE ACCOUNT','REVIEW · TWO METHODS'],
    timelineNotes:['Start before the feud.','Compare later memories of it.','Record only what the audience sees.','Ask who was expected to read it.','Verify the trip independently.','Trace what the witness could see.','Keep each act on its own thread.'],
    scribbles:['same effect, different method','why leave the journal?','map the backstage sightline','follow the intended reader','separate the two performances','who could verify this?'],
    linkLabel:'TWO ACTS'
  },
  {
    id:'memento',title:'The Memory Trail',source:'Memento',year:2000,
    credits:['Written and directed by Christopher Nolan','Based on a short story by Jonathan Nolan'],
    creditUrl:'https://catalog.afi.com/Film/53928-MEMENTO',code:'MM-00',accent:'#697c97',
    description:'Leonard relies on photos, annotations, and tattoos to investigate a past he cannot reliably reconstruct.',
    tags:['Unreliable narrator','Two timelines','Evidence provenance'],
    center:'THE MEMORY TRAIL\n\nLeonard treats written reminders as stable facts.\nFor each one, ask who recorded it and what they knew at the time.',
    theory:'TWO ORDERS OF EVENTS\n\nKeep the order in which the film shows events separate from the order in which they happened.',
    question:'WHO WROTE THE LABEL?\n\nA photograph can establish that a person was there.\nWhat establishes the truth of the words written on it?',
    clusters:[
      clue('LEONARD SHELBY','portrait','01 / LEONARD','Leonard relies on external records to carry information forward.','Track moments where he makes a judgment before writing it down.','Separate what he remembers from what someone tells him.'),
      clue('THE POLAROIDS','report','02 / PHOTOS','Record each pictured subject separately from the caption.','A caption can outlast the reason it was written.','Look for any independent confirmation of the claim.'),
      clue('THE TATTOOS','diagram','03 / TATTOOS','Leonard treats tattoos as higher-confidence records.','Trace whether each item began as an observation or an inference.','A permanent record may still preserve a temporary conclusion.'),
      clue('TEDDY','portrait','04 / TEDDY','Teddy supplies context Leonard cannot check from memory alone.','List what can be independently verified.','Keep claims about his motive separate from evidence about his actions.'),
      clue('NATALIE','portrait','05 / NATALIE','Natalie provides useful information at several points.','Compare what Leonard knows before and after each encounter.','Track whether any written reminder comes from her account.'),
      clue('SAMMY JANKIS','letter','06 / SAMMY','Leonard retells a case from his earlier work.','Compare how the story functions in the investigation with what it actually verifies.','Mark which details come solely from Leonard’s narration.'),
      clue('MOTEL RECORDS','receipt','07 / MOTEL','Room information can be checked outside Leonard’s memory.','Compare receipts, room numbers and the order of visits.','Record which information Leonard has when he returns.'),
      clue('THE TWO SEQUENCES','report','08 / ORDER','Track the color and black-and-white sequences separately.','Find the point at which they join.','Revisit the captions that gained a different meaning once the chronology was clear.')
    ],
    timeline:['MOTEL · RECORDS CONSULTED','CALL · STORY RETOLD','ENCOUNTERS · ACCOUNTS CONFLICT','REMINDERS · FACTS RECORDED','PHOTOGRAPHS · CAPTIONS COMPARED','SEQUENCES · TIMELINES JOIN','REVIEW · PROVENANCE CHECKED'],
    timelineNotes:['Start with a record he can see.','Label narration as a source.','Track what is known at each encounter.','Separate observation from interpretation.','Who wrote each line?','Align the two strands.','Which facts survive the comparison?'],
    scribbles:['label the source, not just the clue','photo and caption are separate','two timelines','verification before belief','compare room numbers','who knew what when?'],
    linkLabel:'CHECK THE SOURCE'
  }
]
