// Safety filter that runs on every customer message BEFORE any answer is made (test mode and Claude mode).
// It does not use AI, so it cannot be talked out of its rules.
//
// It is strict on purpose: when in doubt it refuses. A refused customer still gets a polite answer
// and the contact form, so a wrong refusal costs a little time, a wrong answer could cost much more.
//
// Categories (checked in this order):
//   selfHarm  - someone may want to hurt themselves      -> helpline numbers
//   emergency - an accident with a chemical               -> 112 / doctor / SDS section 4
//   harm      - weapons, explosives, drugs, poisoning, getting around rules, tricking the bot -> refuse
//   chemical  - how to use, mix, make, dose, store or dispose of a chemical, or what it does -> refuse + SDS

// Lowercase, without accents (é -> e), so "cocaïne" and "cocaine" match the same rule
export function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[​-‏⁠﻿]/g, '') // invisible characters used to sneak words past filters
        .replace(/\s+/g, ' ')
        .trim();
}

// Undo simple letter tricks: m3th -> meth, @ -> a, $ -> s
function unLeet(text) {
    return text.replace(/[0134578@$!|]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i' })[c]);
}

const rules = {
    selfHarm: [
        /\b(zelfmoord|suicide|suicidal|zelfdoding|selbstmord|suizid|mezelf (van kant|dood|iets aan)|myself (dead|killed)|kill myself|end my life|mijn leven (beeindigen|beëindigen)|niet meer leven|me tuer|mich umbringen|wil dood|want to die)\b/,
    ],
    emergency: [
        /\b(ingeslikt|doorgeslikt|opgedronken|swallowed|ingested|verschluckt|getrunken|avale|ingere)\b/,
        /\b(in (mijn|m'n|zijn|haar|my|his|her) (oog|ogen|eye|eyes|mond|mouth)|ins auge|dans (les|mon) yeux?)\b/,
        /\b(ingeademd|inhaled|eingeatmet|inhale)\b/,
        /\b(brandwond|verbrand|chemical burn|verätzung|veratzung|brulure)\b/,
        /\b(vergiftigd|poisoned|vergiftet|empoisonne)\b/,
        /\b(gemorst op|spilled on|spilt on|op (mijn|m'n) huid|on my skin|auf (die|meine) haut|sur (la|ma) peau)\b/,
    ],
    harm: [
        // Explosives, weapons, chemical weapons
        /\b(explosie(f|ven|ve)|explosive?s?|sprengstoff|explosif|explosivo|bom(men)?|bombs?|bombe|granaat|grenade|detonat\w*|ontsteker|zuender|zunder)\b/,
        /\b(tatp|hmtd|nitroglycerin\w*|nitroglycerine|thermi(e)?te?|napalm|anfo|pipe ?bomb|molotov|flash ?powder|flitspoeder|semtex|c-?4)\b/,
        /\b(sarin|soman|tabun|vx|novichok|mosterdgas|mustard gas|senfgas|zenuwgas|nerve agent|nervenkampfstoff|fosgeen|phosgene?|chloorgas maken|chlorine gas|ricin\w*|abrin|anthrax|miltvuur)\b/,
        /\b(wapen|weapon|waffe|arme chimique|chemisch wapen|chemical weapon|biowapen|bioweapon)\w*\b/,
        // Drugs and their production
        /\b(meth|crystal ?meth|methamfetamine|methamphetamine?|amfetamine|amphetamine?|speed maken|mdma|xtc|ecstasy|ghb|gbl|ketamine?|cocaine|coke|crack|heroine?|fentanyl\w*|lsd|dmt|mescaline|psilocybin\w*|drugs?|drogen?|droge|narcotic\w*|verdovend)\b/,
        /\b(bmk|pmk|apaan|p2p|safrol\w*|ephedrine?|efedrine|pseudo-?ephedrine?|red phosphorus|rode fosfor|lab(oratorium)? thuis voor drugs|drugslab|drug lab)\b/,
        // Hurting others
        /\b(vergiftig\w*|poison(ing)? (someone|somebody|him|her|a person|people|my)|vergiften|empoisonner|kill (someone|somebody|him|her|people)|iemand (doden|vermoorden|ziek maken|pijn doen)|dodelijke dosis|lethal dose|letale dosis|todliche dosis|dose mortelle|onopgemerkt|untraceable|niet te traceren|zonder sporen)\b/,
        // Getting around rules (licences, precursor law, customs, age checks)
        /\b(zonder (vergunning|registratie|legitimatie|id)|without (a )?(licen[cs]e|permit|registration|id)|ohne (genehmigung|erlaubnis|lizenz)|sans (licence|autorisation)|omzeil\w*|bypass\w*|circumvent\w*|umgehen|contourner|douane (ontwijken|omzeilen)|avoid customs|niet melden|not report|anoniem bestellen|order anonymously|verdacht(e)? transactie)\b/,
        // Trying to change the bot's rules
        /\b(ignore (all |your |the |previous |prior |above )+(instructions|rules|prompts?)|negeer (alle |je |jouw |de |vorige )*(instructies|regels)|ignoriere (alle |deine )*(anweisungen|regeln)|system ?prompt|jailbreak|developer mode|dan mode|act as|pretend (you are|to be)|doe alsof|roleplay|rollenspel|you are now|je bent nu|hypothetic\w*|hypothetisch\w*|for a (story|novel|book|movie|film)|voor een (verhaal|boek|film)|fictional|fictief)\b/,
    ],
    chemical: [
        // Making, mixing, reacting
        /\b(synthe\w*|bereid(en|ing|t)|maken van|zelf maken|thuis maken|how (do i|to|can i|would i|could i) (make|produce|prepare|synthesi[sz]e|extract|cook|brew|create)|hoe (maak|maken|bereid|krijg) (ik|je|je zelf|men)|herstellen|herstel ich|fabriquer|preparer|extraheren|extract(ion)?|isoleren|isolate|zuiveren|(zuiver|destilleer|extraheer|isoleer|kristalliseer|neutraliseer) (ik|je|men|het|dit)|purify|purification|destilleren|distil\w*|raffiner|recrystalli\w*|herkristalli\w*|kristalliseren)\b/,
        /\b(meng\w*|vermeng\w*|mix(en|ing|ture)?|combine(ren|r)?|samenvoegen|misch\w*|melanger|melange|mezclar)\b/,
        /\b(reag\w*|reacti\w*|react\w*|reaktion\w*|neutralis\w*|oplos\w*|dissolv\w*|aufloesen|auflosen|verdun\w*|dilut\w*|verdunn\w*|concentr\w*|konzentr\w*|ontleden|decompos\w*|verbrand(en|t)? met|ontbrand\w*|ignit\w*|ontvlam\w*|oxideer\w*|oxidi[sz]\w*|catalys\w*|katalys\w*)\b/,
        // Use, dose, effects, safety advice
        /\b(hoe (gebruik|gebruiken|toepassen|dosee?r)|how (do i|to|should i|can i) (use|apply|dose|handle|store|dispose|clean)|wie (verwende|benutze|dosiere)|comment (utiliser|doser))\b/,
        /\b(dosis|doses?|dosering|dosage|dosieren|hoeveel (moet|kan|mag) ik|how much (should|can|do) i|innemen|inname|drinken|eten|ingest\w*|consum\w*|roken|smoke|snuiven|sniff|snort|inject\w*)\b/,
        /\b(gevaarlijk|dangerous|gefahrlich|dangereux|giftig|toxic\w*|toxisch|schadelijk|harmful|veilig (om|te|is)|safe to|is (het|dit) veilig|is (it|this) safe|wat gebeurt (er )?als|what happens (if|when)|effect(en)? (van|op)|effects? (of|on)|wirkung|werking|bijwerking|side effect|kankerverwekkend|carcinogen\w*)\b/,
        /\b(opslaan|bewaren|opslag|store|storage|lagern|weggooien|afvoeren|dispose|disposal|entsorgen|vernietigen|wegspoelen|door de gootsteen|down the drain)\b/,
        /\b(concentratie|concentration|molair|molar|molariteit|molarity|ph[- ]waarde|ph value|kookpunt|boiling point|smeltpunt|melting point|vlampunt|flash point|formule|formula|reactievergelijking|equation|stoichiometr\w*|stochiometr\w*)\b/,
    ],
};

// Words that make a "chemical" rule match harmless in a shop context ("can I combine two orders", "mix-up in my order").
// Only applies to the chemical category, never to harm, emergency or selfHarm.
const shopContext =
    /\b(bestelling(en)?|order(s)?|pakket(je)?|package|parcel|zending|shipment|levering|delivery|verzend\w*|shipping|factu(u)?r(en)?|invoice|rekening|bill|betaling|payment|retour\w*|return\w*|refund|account|wachtwoord|password|adres|address|kortingscode|discount|coupon)\b/;
const shopSafeChemicalWords = /\b(combine(ren|r)?|samenvoegen|mix-?up|mixed up|door elkaar|opslaan|store|bewaren|verzendkosten|consument|consumer)\b/g;

// Checks one customer message. Returns { allowed: true } or { allowed: false, category }
export function checkMessage(text) {
    const plain = normalize(text);
    const variants = [plain, unLeet(plain), plain.replace(/[.\-_*]/g, '')];

    const matches = (category) => rules[category].some((rule) => variants.some((variant) => rule.test(variant)));

    if (matches('selfHarm')) return { allowed: false, category: 'selfHarm' };
    if (matches('emergency')) return { allowed: false, category: 'emergency' };
    if (matches('harm')) return { allowed: false, category: 'harm' };

    if (matches('chemical')) {
        // "Can I combine two orders?" is fine; "Can I combine acid with ..." is not.
        // The message is only let through when the chemical match is one of the harmless shop words
        // AND the message is clearly about the shop.
        const withoutSafeWords = plain.replace(shopSafeChemicalWords, ' ');
        const stillChemical = rules.chemical.some((rule) => rule.test(withoutSafeWords));
        if (stillChemical || !shopContext.test(plain)) return { allowed: false, category: 'chemical' };
    }

    return { allowed: true };
}
