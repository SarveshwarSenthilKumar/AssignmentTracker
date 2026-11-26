const lead=(name,kind,code,...notes)=>({name,kind,code,notes,color:'#fff1a8'})

export const ORIGINAL_DETECTIVE_CASES=[
  {
    id:'glasshouse-swap',title:'The Glasshouse Swap',source:'Original fictional case',code:'GH-12',accent:'#658873',
    description:'A botanical garden opens a sealed display and finds a paper replica in place of its prize orchid.',
    tags:['Museum swap','Mistaken identity','Access records'],
    center:'THE GLASSHOUSE SWAP\n\nAn orchid disappeared from a sealed display.\nWhen was the plant last identified by someone who knew it?',
    theory:'TWO DISPLAY CASES\n\nThe stage plan and the inventory call different stands “Case 12.”\nCheck the photos for a stand identifier.',
    question:'FOLLOW THE PLANT\n\nDid someone take an orchid from the north gallery, or was the north gallery expecting the wrong delivery?',
    clusters:[
      lead('NORTH GALLERY','diagram','01 / NORTH','The display seal was fitted at 08:05.','The security photo shows a flower shape under a cover.','The frame has a chipped left foot.'),
      lead('SOUTH GALLERY','diagram','02 / SOUTH','A covered display arrived during rehearsal.','The stage plan calls its stand Case 12.','The photo shows an intact left foot.'),
      lead('PAPER WORKSHOP','receipt','03 / PAPER','The workshop made one full-size replica.','Its delivery slip names the rehearsal stage.','The replica has a visible wire loop on its pot.'),
      lead('ORCHID LOGBOOK','report','04 / ORCHID','The living plant was watered at 06:40.','The conservator marked its pot with a blue tie.','The north gallery photo is too distant to show the tie.'),
      lead('MORNING PORTER','portrait','05 / PORTER','Both covered exhibits were tagged before loading.','The porter followed a printed case number.','The route changed when the west corridor flooded.'),
      lead('POTTING BENCH','letter','06 / BENCH','The orchid was left in a lined tray.','The replica was left in a lined tray of the same size.','The pot numbers are hidden when the trays are carried.'),
      lead('REHEARSAL RECORDING','report','07 / STAGE','A blue tie is visible between leaves in the wide shot.','The display in the shot has both feet intact.','The timestamp is earlier than the north gallery seal.'),
      lead('LABEL PRINTOUT','receipt','08 / LABELS','The same printer issued both Case 12 tags.','One came from inventory and one from staging.','The two print jobs were logged 90 seconds apart.')
    ],
    timeline:['06:40 · ORCHID WATERED','07:02 · REPLICA LOGGED','07:18 · LABELS PRINTED','07:45 · ROUTE DIVERTED','07:56 · REHEARSAL FILMED','08:05 · NORTH DISPLAY SEALED','09:10 · REPLICA DISCOVERED'],
    timelineNotes:['Look for the blue tie.','Wire loop on the pot.','Two sources for the same number.','Who picked which tray?','Find the intact frame.','Seal proves only what happened after this time.','Check the south stand.'],
    scribbles:['a silhouette is not an ID','blue tie','check the film frame','Case 12 ≠ Case 12','two pot trays','which left foot?'],
    linkLabel:'FOLLOW THE LABEL'
  },
  {
    id:'bell-between-tides',title:'The Bell Between Tides',source:'Original fictional case',code:'BT-04',accent:'#587d9b',
    description:'A harbor bell rings on a foggy evening even though its clapper is sealed in the maritime museum.',
    tags:['Acoustic clues','Harbor records','Contradictory witnesses'],
    center:'THE BELL BETWEEN TIDES\n\nThree witnesses heard a bell after closing.\nThe museum seal was intact.\nWhich bell did they hear?',
    theory:'COMPARE RECORDINGS\n\nThe harbor sound repeats the rehearsal pattern, including the uneven last strike.\nCheck what was still playing after closing.',
    question:'LOOK ACROSS THE WATER\n\nCould the sound have come from the festival ferry and still seemed to come from the tower?',
    clusters:[
      lead('BELL TOWER','diagram','01 / TOWER','The tower recorder logged the sound at 20:14.','The maintenance sheet shows the clapper removed.','No footsteps appear on the tower stair counter.'),
      lead('MARITIME MUSEUM','report','02 / SEAL','The clapper display was sealed before closing.','The closing photo shows the seal unbroken.','The morning guard logged the same seal number.'),
      lead('FESTIVAL FERRY','map','03 / FERRY','The ferry moved to a temporary berth at 20:10.','Its deck speakers faced the tower across the harbor.','The berth was empty in the earlier schedule.'),
      lead('REHEARSAL AUDIO','report','04 / AUDIO','The rehearsal cue has five strikes.','The last strike comes noticeably late.','The tower recording has the same uneven interval.'),
      lead('HARBOR WALK','portrait','05 / WITNESS','A walker heard the bell from the seawall.','The walker did not see the tower through the fog.','The sound stopped when the ferry lights appeared.'),
      lead('STAGE PLAYLIST','letter','06 / PLAYLIST','One cue was labeled Evening Bell.','A copy was set to repeat during equipment checks.','The checklist left the audio stop box blank.'),
      lead('BERTH CHANGE','receipt','07 / BERTH','The west berth was closed for repairs.','The ferry master signed for the east berth instead.','The change arrived after the printed programs went out.'),
      lead('DOCK RECORDER','report','08 / DOCK','The dock recording caught the first strike slightly before the tower recorder.','Both recorders were synchronized at the noon check.','Compare the order with the two possible sound sources.')
    ],
    timeline:['18:00 · DISPLAY SEALED','18:25 · AUDIO REHEARSED','19:40 · BERTH CLOSED','20:10 · FERRY RELOCATED','20:14 · BELL REPORTED','20:16 · DOCK CALL','08:30 · SEAL RECHECKED'],
    timelineNotes:['Record the serial number.','Count the strike intervals.','Printed schedule is stale.','New vantage point.','Ask what anyone actually saw.','Check recorder timestamps.','The clapper stayed put.'],
    scribbles:['the last strike is late','ears do not give coordinates','same seal number','why did it stop?','check the actual berth','five strikes, not four'],
    linkLabel:'THE UNEVEN STRIKE'
  },
  {
    id:'archive-blank-page',title:'The Archive’s Blank Page',source:'Original fictional case',code:'AR-31',accent:'#9a7858',
    description:'Visitors see a blank page where the town charter should be. The display log says no one opened the case.',
    tags:['Archive records','Restoration','A misleading display'],
    center:'THE ARCHIVE’S BLANK PAGE\n\nThe charter appears blank at opening.\nThe case was sealed all night.\nWhat did the display actually contain?',
    theory:'CHECK THE REPRODUCTION\n\nThe archive keeps a facsimile for the lighted case.\nA fresh test print might look exactly like the display sheet from the back.',
    question:'FIND THE REAL CHARTER\n\nCompare the storage receipt with the display checklist. Which one tracks the original?',
    clusters:[
      lead('CHARTER CASE','diagram','01 / CASE','The installation photo shows a small notch on the lower edge.','That notch marks the mount, not the paper.','No door opening appears in the overnight log.'),
      lead('CONSERVATOR’S VAULT','report','02 / VAULT','The original was signed into storage two weeks ago.','The checkout column is blank.','The accession number ends in A, unlike the display sheet.'),
      lead('PRINT STUDIO','receipt','03 / PRINT','The studio issued two large sheets at 16:10.','One was an alignment test with an unprinted face.','Both sheets bear a pencil dot on the reverse.'),
      lead('INSTALLATION CART','diagram','04 / CART','The cart has a display pocket and a scrap pocket.','A drawer label was replaced before opening.','The staff photo shows the label on the opposite pocket.'),
      lead('GALLERY VOLUNTEER','portrait','05 / VOLUNTEER','The volunteer saw paper slide into the mount.','The face was covered by protective tissue.','They remember the pencil dot, not the accession number.'),
      lead('WORK ORDER','letter','06 / ORDER','The work order calls for a new facsimile.','It specifies display stock number AR-31-F.','The completion check was signed before the final review.'),
      lead('OPENING PHOTOS','report','07 / PHOTOS','A curled printed corner appears on the cart in one opening photo.','The display case is closed in that image.','Check the cart pocket under the folded cloth.'),
      lead('MORNING INVENTORY','receipt','08 / INVENTORY','A large sheet remains on the cart.','Its reverse carries AR-31-F in pencil.','The vault inventory still lists the original in place.')
    ],
    timeline:['TWO WEEKS EARLIER · VAULT SIGN-IN','16:10 · TWO PRINTS ISSUED','16:28 · CART REPAIRED','16:45 · SHEET MOUNTED','17:00 · CASE SEALED','08:20 · OPENING PHOTO','09:00 · BLANK DISPLAY REPORTED'],
    timelineNotes:['Track number AR-31-A.','One sheet is a test.','Check which pocket got relabeled.','What could the witness see?','The installation came first.','Look for the printed corner.','Check storage before assuming theft.'],
    scribbles:['original ≠ facsimile','ask about the pencil dot','look under the cloth','sign-off came early','what was covered?','the notch is on the mount'],
    linkLabel:'THE WRONG SHEET'
  },
  {
    id:'observatory-twelfth-star',title:'The Observatory’s Twelfth Star',source:'Original fictional case',code:'OS-12',accent:'#776a99',
    description:'An extra star appears on the observatory’s commemorative plate, but every telescope log says the field contained eleven.',
    tags:['Photography','Lab mix-up','Observational evidence'],
    center:'THE OBSERVATORY’S TWELFTH STAR\n\nThe exhibition plate shows twelve points.\nThe notebook records eleven.\nWhich record is a direct observation?',
    theory:'TWO EXPOSURES\n\nA loose reference mask may have shifted between prints.\nCompare the mark positions against the raw plates.',
    question:'FOLLOW THE EXTRA POINT\n\nDoes it move with the sky or stay fixed to the exhibition mount?',
    clusters:[
      lead('ORIGINAL PLATES','report','01 / RAW','Each raw plate shows eleven points.','The plate corners carry the same event code.','One plate has a separate calibration exposure attached.'),
      lead('EXHIBITION MOUNT','diagram','02 / MOUNT','The mount holds a photograph and a translucent reference sheet.','The sheet can move slightly under the corner tabs.','One corner tab is bent outward.'),
      lead('REFERENCE MASK','receipt','03 / MASK','A white dot marks the alignment position.','The dot should sit outside the picture border.','Tuesday’s proof places it closer to the image edge.'),
      lead('TELESCOPE LOG','report','04 / SCOPE','The field was counted independently twice.','Both counts report eleven visible points.','Thin cloud explains a timing delay, not a new mark.'),
      lead('PRINTMAKER','portrait','05 / PRINT','The exhibition image was checked before mounting.','The extra point was first noticed after transport.','The frame was carried upright down a stairwell.'),
      lead('RUBBER STOPS','receipt','06 / STOPS','A replacement stop arrived after the exhibition opened.','The frame had one missing stop during transport.','The loose sheet can settle lower when the frame stands upright.'),
      lead('EARLY PROOF','letter','07 / PROOF','The early print includes the full border.','The reference dot is visible in the margin.','Compare its distance to the bent corner tab.'),
      lead('SUNDAY PHOTOGRAPH','report','08 / SUNDAY','The extra point stays near the frame edge when the field is turned.','The other eleven points rotate with the printed sky.','The display photograph and the field log can both be accurate.')
    ],
    timeline:['MONDAY · FIELD OBSERVED','TUESDAY · PROOF PRINTED','WEDNESDAY · FRAME ASSEMBLED','THURSDAY · FRAME MOVED','FRIDAY · EXTRA POINT REPORTED','SATURDAY · RAW PLATES CHECKED','SUNDAY · DISPLAY TURNED'],
    timelineNotes:['Independent counts agree.','Inspect the margin.','Check the corner tabs.','What can slide when vertical?','First noticed on display.','Look at the original plates.','Which marks move together?'],
    scribbles:['the dot stays put','raw plate first','check the border','missing stop','two layers of evidence','rotation is the test'],
    linkLabel:'THE EXTRA POINT'
  }
]
