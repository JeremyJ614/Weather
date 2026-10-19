C = "America/Chicago"
E = "America/New_York"
NEW = [
    dict(id="1953-05-11-waco", name="Waco", region="Texas", date="1953-05-11",
         anchor=("TX", "5", 31.55, -97.15), radius=25, violent=50, speed=25, scale="F", tz=C,
         blurb="An F5 through downtown Waco that killed 114, tied as the deadliest tornado in "
               "Texas history. Brick buildings on the town square fell into the street."),
    dict(id="1953-06-08-flint", name="Flint — Beecher", region="Michigan", date="1953-06-08",
         anchor=("MI", "5", 43.1, -83.85), radius=25, violent=50, speed=30, scale="F",
         tz="America/Detroit",
         blurb="An F5 through the Beecher area north of Flint on a Monday evening. 116 died, "
               "and it is still Michigan's deadliest tornado."),
    dict(id="1953-06-09-worcester", name="Worcester", region="Massachusetts", date="1953-06-09",
         anchor=("MA", "4", 42.47, -72.17), radius=25, violent=50, speed=35, scale="F", tz=E,
         blurb="A violent tornado across central Massachusetts the day after Flint. Ninety-four "
               "died, making it New England's deadliest."),
    dict(id="1955-05-25-udall", name="Blackwell — Udall", region="Oklahoma · Kansas",
         date="1955-05-25", anchor=("OK", "5", 36.88, -97.15), radius=25, violent=50, speed=35,
         scale="F", tz=C,
         blurb="Two F5s from the same storm after dark: Blackwell, Oklahoma, then Udall, Kansas. "
               "Udall's toll is still the deadliest of any Kansas tornado."),
    dict(id="1957-05-20-ruskin", name="Ruskin Heights", region="Kansas · Missouri",
         date="1957-05-20", anchor=("KS", "5", 38.45, -95.5), radius=25, violent=50, speed=40,
         scale="F", tz=C,
         blurb="An F5 from eastern Kansas into the south side of Kansas City, straight through "
               "the new Ruskin Heights subdivision. Forty-four died."),
    dict(id="1965-04-11-palmsunday", name="The 1965 Palm Sunday Outbreak",
         region="Iowa to Ohio", date="1965-04-11", outbreak=True, radius=25, speed=50,
         scale="F", tz=C,
         blurb="Violent tornadoes across six states in one afternoon and night, more than 250 "
               "dead. Every F4 and F5 of the day is here, with the tornadoes beside them."),
    dict(id="1966-06-08-topeka", name="Topeka", region="Kansas", date="1966-06-08",
         anchor=("KS", "5", 38.92, -95.92), radius=25, violent=50, speed=25, scale="F", tz=C,
         blurb="An F5 straight through the middle of Topeka, over Burnett's Mound, the hill "
               "local legend said would protect the city."),
    dict(id="1968-05-15-charlescity", name="Charles City", region="Iowa", date="1968-05-15",
         anchor=("IA", "5", 42.77, -93.12), radius=25, violent=60, speed=45, scale="F", tz=C,
         blurb="An F5 through Charles City, one of two F5s in northeast Iowa that afternoon."),
    dict(id="1979-04-10-wichitafalls", name="Wichita Falls — Terrible Tuesday",
         region="Texas", date="1979-04-10", anchor=("TX", "4", 33.82, -98.65), radius=25,
         violent=60, speed=30, scale="F", tz=C,
         blurb="An F4 through the south side of Wichita Falls at rush hour. Forty-two died, many "
               "of them in cars, which changed the advice on sheltering in a vehicle."),
    dict(id="1984-06-07-barneveld", name="Barneveld", region="Wisconsin", date="1984-06-07",
         anchor=("WI", "5", 42.97, -89.98), radius=25, violent=50, speed=40, scale="F", tz=C,
         blurb="An F5 just after midnight that destroyed most of the village of Barneveld in "
               "minutes."),
    dict(id="1990-08-28-plainfield", name="Plainfield", region="Illinois", date="1990-08-28",
         anchor=("IL", "5", 41.68, -88.35), radius=25, violent=50, speed=30, scale="F", tz=C,
         blurb="The only F5 ever recorded in August, through Plainfield southwest of Chicago. "
               "No tornado warning was issued before it struck."),
    dict(id="1998-04-08-oakgrove", name="Oak Grove — Birmingham", region="Alabama",
         date="1998-04-08", anchor=("AL", "5", 33.42, -87.35), radius=25, violent=50, speed=40,
         scale="F", tz=C,
         blurb="An F5 at night through the western suburbs of Birmingham: Oak Grove, Rock Creek "
               "and Edgewater."),
    dict(id="2004-05-22-hallam", name="Hallam", region="Nebraska", date="2004-05-22",
         anchor=("NE", "4", 40.32, -97.33), radius=25, violent=50, speed=20, scale="F", tz=C,
         blurb="About two and a half miles across, the widest tornado on record at the time. It "
               "all but erased the village of Hallam."),
    dict(id="2007-05-04-greensburg", name="Greensburg", region="Kansas", date="2007-05-04",
         anchor=("KS", "5", 37.3934, -99.3826), radius=25, violent=50, speed=15, scale="EF",
         tz=C,
         blurb="A 1.7-mile-wide tornado at night that destroyed about 95 percent of Greensburg: "
               "the first EF5 rated after the Enhanced Fujita scale took over that February."),
    dict(id="2008-02-05-supertuesday", name="Super Tuesday — Atkins", region="Arkansas",
         date="2008-02-05", anchor=("AR", "4", 35.0975, -93.0733), radius=25, violent=50,
         speed=45, scale="EF", tz=C,
         blurb="A 122-mile EF4 across Arkansas on the night of the presidential primaries, in an "
               "outbreak that killed 57 across the South."),
    dict(id="2008-05-25-parkersburg", name="Parkersburg — New Hartford", region="Iowa",
         date="2008-05-25", anchor=("IA", "5", 42.5512, -92.882), radius=25, violent=50,
         speed=35, scale="EF", tz=C,
         blurb="An EF5 on Memorial Day weekend that flattened about a third of Parkersburg, "
               "then crossed New Hartford."),
    dict(id="2010-06-17-wadena", name="Wadena", region="Minnesota", date="2010-06-17",
         anchor=("MN", "4", 46.41, -95.18), radius=30, violent=60, speed=40, scale="EF", tz=C,
         blurb="A wide EF4 through Wadena on Minnesota's biggest tornado day on record."),
    dict(id="2011-04-27-hackleburg", name="Hackleburg — Phil Campbell",
         region="Alabama · Tennessee", date="2011-04-27",
         anchor=("AL", "5", 34.1043, -88.1479), radius=25, violent=40, speed=50, scale="EF",
         tz=C,
         blurb="The deadliest tornado of the 2011 Super Outbreak: an EF5 on the ground for 132 "
               "miles from northwest Alabama into Tennessee."),
    dict(id="2011-04-27-tuscaloosa", name="Tuscaloosa — Birmingham", region="Alabama",
         date="2011-04-27", anchor=("AL", "4", 33.0297, -87.935), radius=25, violent=40,
         speed=45, scale="EF", tz=C,
         blurb="An EF4 shown live on television as it crossed Tuscaloosa and then the western "
               "suburbs of Birmingham. Sixty-four died."),
    dict(id="2012-03-02-henryville", name="Henryville", region="Indiana · Kentucky",
         date="2012-03-02", anchor=("IN", "4", 38.4316, -86.1893), radius=25, violent=50,
         speed=55, scale="EF", tz="America/Indiana/Indianapolis",
         blurb="An EF4 that destroyed much of Henryville, its school included, in the early "
               "March outbreak."),
    dict(id="2013-05-20-moore", name="Moore", region="Oklahoma", date="2013-05-20",
         anchor=("OK", "5", 35.284, -97.628), radius=25, violent=45, speed=20, scale="EF", tz=C,
         blurb="An EF5 through Moore fourteen years after the 1999 tornado crossed the same "
               "city. Twenty-four died, seven of them children at Plaza Towers Elementary."),
    dict(id="2013-11-17-washington", name="Washington", region="Illinois", date="2013-11-17",
         anchor=("IL", "4", 40.622, -89.5678), radius=25, violent=50, speed=55, scale="EF",
         tz=C,
         blurb="A November EF4 through Washington on a Sunday morning, one of the strongest "
               "late-season tornadoes the Midwest has seen."),
    dict(id="2014-04-27-vilonia", name="Mayflower — Vilonia", region="Arkansas",
         date="2014-04-27", anchor=("AR", "4", 34.7787, -92.652), radius=25, violent=50,
         speed=40, scale="EF", tz=C,
         blurb="An EF4 across Interstate 40 and through Vilonia, three years after another "
               "tornado hit the same town."),
    dict(id="2014-06-16-pilger", name="Pilger — the twins", region="Nebraska",
         date="2014-06-16", anchor=("NE", "4", 41.9528, -97.1369), radius=25, violent=40,
         speed=20, scale="EF", tz=C,
         blurb="Two EF4s side by side from one storm for nearly an hour, one of them through "
               "Pilger. Twin violent tornadoes are almost never seen."),
    dict(id="2019-05-28-linwood", name="Linwood", region="Kansas", date="2019-05-28",
         anchor=("KS", "4", 38.8381, -95.3665), radius=25, violent=50, speed=25, scale="EF",
         tz=C,
         blurb="A wide EF4 across the Kansas River valley between Lawrence and Kansas City, "
               "after weeks of record rain. Nobody was killed."),
    dict(id="2020-03-03-nashville", name="Nashville — Cookeville", region="Tennessee",
         date="2020-03-03", anchor=("TN", "3", 36.1717, -86.9562), radius=25, violent=70,
         speed=40, scale="EF", tz=C,
         blurb="After midnight, an EF3 across downtown Nashville; an hour later the same storm "
               "dropped an EF4 on Cookeville that killed nineteen."),
    dict(id="2020-04-12-bassfield", name="Bassfield — Soso", region="Mississippi",
         date="2020-04-12", anchor=("MS", "4", 31.4641, -89.7579), radius=25, violent=50,
         speed=50, scale="EF", tz=C,
         blurb="On Easter Sunday, an EF4 about two and a quarter miles wide, the widest ever "
               "recorded in Mississippi."),
    dict(id="2023-03-31-littlerock", name="Little Rock", region="Arkansas", date="2023-03-31",
         anchor=("AR", "3", 34.7251, -92.4824), radius=25, violent=50, speed=40, scale="EF",
         tz=C,
         blurb="An EF3 through west and north Little Rock on a Friday afternoon, in an outbreak "
               "that also struck Wynne the same day."),
    dict(id="2024-05-06-barnsdall", name="Barnsdall", region="Oklahoma", date="2024-05-06",
         anchor=("OK", "4", 36.3304, -96.3559), radius=25, violent=50, speed=25, scale="EF",
         tz=C,
         blurb="An EF4 late at night through Barnsdall and on toward Bartlesville."),
    dict(id="2025-03-14-outbreak", name="The March 2025 outbreak", region="Arkansas · Missouri",
         date="2025-03-14", outbreak=True, radius=25, speed=50, scale="EF", tz=C,
         blurb="The first night of a three-day outbreak across the middle of the country, with "
               "long-track EF4s across northern Arkansas. Every EF4 of the night is here, with "
               "the tornadoes near them."),
    dict(id="2025-05-16-london", name="Somerset — London", region="Kentucky",
         date="2025-05-16", anchor=("KY", "4", 37.0159, -85.0325), radius=25, violent=50,
         speed=50, scale="EF", tz=E,
         blurb="A long-track EF4 across southeastern Kentucky near midnight, through the city of "
               "London."),
]
