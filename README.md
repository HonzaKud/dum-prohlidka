# Náš dům — prostorová studie

Minimalistický 3D prohlížeč exteriéru odvozeného z jednoho AI obrázku. Rozměry i neviditelné fasády jsou orientační; nejde o projektovou dokumentaci.

## Ovládání
- Otáčení: tažením model obcházíš, kolečkem nebo gestem přibližuješ.
- Chůze: WASD, myš po spuštění pohledu, Shift rychleji, Esc uvolní myš. Výška očí 1,7 m. Bez kolizí.
- Let: stejné ovládání s přidaným pohybem nahoru/dolů.
- Telefon: v chůzi a letu levý joystick, pravá plocha pro rozhlížení, v letu tlačítka nahoru/dolů. Otáčení podporuje dotyková gesta.
- Začátek: vrátí kameru na výchozí místo aktuálního režimu.

## Vývoj a publikace
Node.js 22.12+ nebo 24+, npm.
~~~powershell
npm ci
npm run dev
npm test
npm run build
~~~
Sestavení používá relativní cesty pro GitHub Pages. Publikovaný obsah je ve složce docs (kopie ověřeného dist). Public assets obsahují jen odvozený model, žádný původní snímek pozemku ani osobní dokumentaci.

Knihovny Three.js (MIT) a Vite (MIT). Vykreslování probíhá v prohlížeči, bez serverového backendu a API klíčů.

## Ověření
GLB kontrola geometrie a načtení přes GLTFLoader prošly. Ovládání prověřeno staticky a scénářem rychlosti pohybu, normalizace a výšky očí. V Edge ověřeno načtení, režimy, klávesnice a virtuální ovladače ve viewportu 390 × 844 a 320 × 640. Fyzický telefon ani headset zatím netestovány.

## Quest 2 / WebXR

Otevři veřejný web v prohlížeči Meta Questu a stiskni tlačítko VR vpravo nahoře. Po povolení se spustí prostorový režim immersive-vr.

- Levá páčka: chůze podle směru pohledu (1,4 m/s).
- Pravá páčka: otáčení po 30 stupních, další krok po vrácení páčky do středu.
- A nebo X: návrat před dům.
- Spoušť při pohybu: zrychlení.
- Systémová nabídka headsetu: návrat z VR.
Používá se skutečná sledovaná výška očí a měřítko v metrech. Zatím bez kolizí a teleportování.
Při ukončení VR se obnoví běžný pohled. Na počítači bez VR se po kliknutí objeví vysvětlení, ostatní režimy fungují dál.
Ověřeno: automatické scénáře WebXR lifecycle a výpočtů pohybu, build, desktop a mobilní rozložení. Skutečné stereo, výkon a ovladače na fyzickém Questu 2 zatím neověřeny.
