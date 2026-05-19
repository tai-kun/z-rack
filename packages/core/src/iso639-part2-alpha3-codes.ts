/*

// https://ja.wikipedia.org/wiki/ISO_639-2コード一覧

const tCodes = new Set();

for (const table of document.querySelectorAll("table.wikitable")) {
  for (const row of table.querySelectorAll("tbody tr")) {
    const cells = row.querySelectorAll("td");

    if (cells.length === 0) {
      continue;
    }

    const type = cells[4]?.textContent?.trim();

    if (type !== "Individual" && type !== "Collective" && type !== "Macrolanguage") {
      continue;
    }

    const iso639_2 = cells[0]?.textContent?.trim();
    if (!iso639_2) {
      continue;
    }

    const parts = iso639_2.split("/").map((s) => s.trim());

    let tCode = null;

    if (parts.length === 1) {
      tCode = parts[0];
    } else {
      // "*" が付いていない方が T コード
      tCode = parts.find((p) => !p.includes("*"));
    }

    if (!tCode) {
      continue;
    }

    tCode = tCode.replace(/[*]/g, "").trim();

    if (/^[a-z]{3}$/.test(tCode)) {
      tCodes.add(tCode);
    }
  }
}

console.log('| "' + [...tCodes].sort().join('"\n"') + '",');

*/

/**
 * ISO 639-2 / Terminology (alpha-3) 形式の言語コードを定義する型定義です。
 */
export type Iso639Part2Alpha3Code =
  | "aar"
  | "abk"
  | "ace"
  | "ach"
  | "ada"
  | "ady"
  | "afa"
  | "afh"
  | "afr"
  | "ain"
  | "aka"
  | "akk"
  | "ale"
  | "alg"
  | "alt"
  | "amh"
  | "ang"
  | "anp"
  | "apa"
  | "ara"
  | "arc"
  | "arg"
  | "arn"
  | "arp"
  | "art"
  | "arw"
  | "asm"
  | "ast"
  | "ath"
  | "aus"
  | "ava"
  | "ave"
  | "awa"
  | "aym"
  | "aze"
  | "bad"
  | "bai"
  | "bak"
  | "bal"
  | "bam"
  | "ban"
  | "bas"
  | "bat"
  | "bej"
  | "bel"
  | "bem"
  | "ben"
  | "ber"
  | "bho"
  | "bih"
  | "bik"
  | "bin"
  | "bis"
  | "bla"
  | "bnt"
  | "bod"
  | "bos"
  | "bra"
  | "bre"
  | "btk"
  | "bua"
  | "bug"
  | "bul"
  | "byn"
  | "cad"
  | "cai"
  | "car"
  | "cat"
  | "cau"
  | "ceb"
  | "cel"
  | "ces"
  | "cha"
  | "chb"
  | "che"
  | "chg"
  | "chk"
  | "chm"
  | "chn"
  | "cho"
  | "chp"
  | "chr"
  | "chu"
  | "chv"
  | "chy"
  | "cmc"
  | "cnr"
  | "cop"
  | "cor"
  | "cos"
  | "cpe"
  | "cpf"
  | "cpp"
  | "cre"
  | "crh"
  | "crp"
  | "csb"
  | "cus"
  | "cym"
  | "dak"
  | "dan"
  | "dar"
  | "day"
  | "del"
  | "den"
  | "deu"
  | "dgr"
  | "din"
  | "div"
  | "doi"
  | "dra"
  | "dsb"
  | "dua"
  | "dum"
  | "dyu"
  | "dzo"
  | "efi"
  | "egy"
  | "eka"
  | "ell"
  | "elx"
  | "eng"
  | "enm"
  | "epo"
  | "est"
  | "eus"
  | "ewe"
  | "ewo"
  | "fan"
  | "fao"
  | "fas"
  | "fat"
  | "fij"
  | "fil"
  | "fin"
  | "fiu"
  | "fon"
  | "fra"
  | "frm"
  | "fro"
  | "frr"
  | "frs"
  | "fry"
  | "ful"
  | "fur"
  | "gaa"
  | "gay"
  | "gba"
  | "gem"
  | "gez"
  | "gil"
  | "gla"
  | "gle"
  | "glg"
  | "glv"
  | "gmh"
  | "goh"
  | "gon"
  | "gor"
  | "got"
  | "grb"
  | "grc"
  | "grn"
  | "gsw"
  | "guj"
  | "gwi"
  | "hai"
  | "hat"
  | "hau"
  | "haw"
  | "heb"
  | "her"
  | "hil"
  | "him"
  | "hin"
  | "hit"
  | "hmn"
  | "hmo"
  | "hrv"
  | "hsb"
  | "hun"
  | "hup"
  | "hye"
  | "iba"
  | "ibo"
  | "ido"
  | "iii"
  | "ijo"
  | "iku"
  | "ile"
  | "ilo"
  | "ina"
  | "inc"
  | "ind"
  | "ine"
  | "inh"
  | "ipk"
  | "ira"
  | "iro"
  | "isl"
  | "ita"
  | "jav"
  | "jbo"
  | "jpn"
  | "jpr"
  | "jrb"
  | "kaa"
  | "kab"
  | "kac"
  | "kal"
  | "kam"
  | "kan"
  | "kar"
  | "kas"
  | "kat"
  | "kau"
  | "kaw"
  | "kaz"
  | "kbd"
  | "kha"
  | "khi"
  | "khm"
  | "kho"
  | "kik"
  | "kin"
  | "kir"
  | "kmb"
  | "kok"
  | "kom"
  | "kon"
  | "kor"
  | "kos"
  | "kpe"
  | "krc"
  | "krl"
  | "kro"
  | "kru"
  | "kua"
  | "kum"
  | "kur"
  | "kut"
  | "lad"
  | "lah"
  | "lam"
  | "lao"
  | "lat"
  | "lav"
  | "lez"
  | "lim"
  | "lin"
  | "lit"
  | "lol"
  | "loz"
  | "ltz"
  | "lua"
  | "lub"
  | "lug"
  | "lui"
  | "lun"
  | "luo"
  | "lus"
  | "mad"
  | "mag"
  | "mah"
  | "mai"
  | "mak"
  | "mal"
  | "man"
  | "map"
  | "mar"
  | "mas"
  | "mdf"
  | "mdr"
  | "men"
  | "mga"
  | "mic"
  | "min"
  | "mkd"
  | "mkh"
  | "mlg"
  | "mlt"
  | "mnc"
  | "mni"
  | "mno"
  | "moh"
  | "mon"
  | "mos"
  | "mri"
  | "msa"
  | "mun"
  | "mus"
  | "mwl"
  | "mwr"
  | "mya"
  | "myn"
  | "myv"
  | "nah"
  | "nai"
  | "nap"
  | "nau"
  | "nav"
  | "nbl"
  | "nde"
  | "ndo"
  | "nds"
  | "nep"
  | "new"
  | "nia"
  | "nic"
  | "niu"
  | "nld"
  | "nno"
  | "nob"
  | "nog"
  | "non"
  | "nor"
  | "nqo"
  | "nso"
  | "nub"
  | "nwc"
  | "nya"
  | "nym"
  | "nyn"
  | "nyo"
  | "nzi"
  | "oci"
  | "oji"
  | "ori"
  | "orm"
  | "osa"
  | "oss"
  | "ota"
  | "oto"
  | "paa"
  | "pag"
  | "pal"
  | "pam"
  | "pan"
  | "pap"
  | "pau"
  | "peo"
  | "phi"
  | "phn"
  | "pli"
  | "pol"
  | "pon"
  | "por"
  | "pra"
  | "pro"
  | "pus"
  | "que"
  | "raj"
  | "rap"
  | "rar"
  | "roa"
  | "roh"
  | "rom"
  | "ron"
  | "run"
  | "rup"
  | "rus"
  | "sad"
  | "sag"
  | "sah"
  | "sai"
  | "sal"
  | "sam"
  | "san"
  | "sas"
  | "sat"
  | "scn"
  | "sco"
  | "sel"
  | "sem"
  | "sga"
  | "sgn"
  | "shn"
  | "sid"
  | "sin"
  | "sio"
  | "sit"
  | "sla"
  | "slk"
  | "slv"
  | "sma"
  | "sme"
  | "smi"
  | "smj"
  | "smn"
  | "smo"
  | "sms"
  | "sna"
  | "snd"
  | "snk"
  | "sog"
  | "som"
  | "son"
  | "sot"
  | "spa"
  | "sqi"
  | "srd"
  | "srn"
  | "srp"
  | "srr"
  | "ssa"
  | "ssw"
  | "suk"
  | "sun"
  | "sus"
  | "sux"
  | "swa"
  | "swe"
  | "syc"
  | "syr"
  | "tah"
  | "tai"
  | "tam"
  | "tat"
  | "tel"
  | "tem"
  | "ter"
  | "tet"
  | "tgk"
  | "tgl"
  | "tha"
  | "tig"
  | "tir"
  | "tiv"
  | "tkl"
  | "tlh"
  | "tli"
  | "tmh"
  | "tog"
  | "ton"
  | "tpi"
  | "tsi"
  | "tsn"
  | "tso"
  | "tuk"
  | "tum"
  | "tup"
  | "tur"
  | "tut"
  | "tvl"
  | "twi"
  | "tyv"
  | "udm"
  | "uga"
  | "uig"
  | "ukr"
  | "umb"
  | "urd"
  | "uzb"
  | "vai"
  | "ven"
  | "vie"
  | "vol"
  | "vot"
  | "wak"
  | "wal"
  | "war"
  | "was"
  | "wen"
  | "wln"
  | "wol"
  | "xal"
  | "xho"
  | "yao"
  | "yap"
  | "yid"
  | "yor"
  | "ypk"
  | "zap"
  | "zbl"
  | "zen"
  | "zgh"
  | "zha"
  | "zho"
  | "znd"
  | "zul"
  | "zun"
  | "zza";

/**
 * ISO 639-2 / Terminology (alpha-3) 形式の言語コードをすべて含んだ読み取り専用の配列です。
 *
 * {@link Iso639Part2Alpha3Code} 型として定義されているすべての文字列リテラルを要素として持ちます。
 */
const ISO639_PART2_ALPHA3_CODES: readonly Iso639Part2Alpha3Code[] = [
  "aar",
  "abk",
  "ace",
  "ach",
  "ada",
  "ady",
  "afa",
  "afh",
  "afr",
  "ain",
  "aka",
  "akk",
  "ale",
  "alg",
  "alt",
  "amh",
  "ang",
  "anp",
  "apa",
  "ara",
  "arc",
  "arg",
  "arn",
  "arp",
  "art",
  "arw",
  "asm",
  "ast",
  "ath",
  "aus",
  "ava",
  "ave",
  "awa",
  "aym",
  "aze",
  "bad",
  "bai",
  "bak",
  "bal",
  "bam",
  "ban",
  "bas",
  "bat",
  "bej",
  "bel",
  "bem",
  "ben",
  "ber",
  "bho",
  "bih",
  "bik",
  "bin",
  "bis",
  "bla",
  "bnt",
  "bod",
  "bos",
  "bra",
  "bre",
  "btk",
  "bua",
  "bug",
  "bul",
  "byn",
  "cad",
  "cai",
  "car",
  "cat",
  "cau",
  "ceb",
  "cel",
  "ces",
  "cha",
  "chb",
  "che",
  "chg",
  "chk",
  "chm",
  "chn",
  "cho",
  "chp",
  "chr",
  "chu",
  "chv",
  "chy",
  "cmc",
  "cnr",
  "cop",
  "cor",
  "cos",
  "cpe",
  "cpf",
  "cpp",
  "cre",
  "crh",
  "crp",
  "csb",
  "cus",
  "cym",
  "dak",
  "dan",
  "dar",
  "day",
  "del",
  "den",
  "deu",
  "dgr",
  "din",
  "div",
  "doi",
  "dra",
  "dsb",
  "dua",
  "dum",
  "dyu",
  "dzo",
  "efi",
  "egy",
  "eka",
  "ell",
  "elx",
  "eng",
  "enm",
  "epo",
  "est",
  "eus",
  "ewe",
  "ewo",
  "fan",
  "fao",
  "fas",
  "fat",
  "fij",
  "fil",
  "fin",
  "fiu",
  "fon",
  "fra",
  "frm",
  "fro",
  "frr",
  "frs",
  "fry",
  "ful",
  "fur",
  "gaa",
  "gay",
  "gba",
  "gem",
  "gez",
  "gil",
  "gla",
  "gle",
  "glg",
  "glv",
  "gmh",
  "goh",
  "gon",
  "gor",
  "got",
  "grb",
  "grc",
  "grn",
  "gsw",
  "guj",
  "gwi",
  "hai",
  "hat",
  "hau",
  "haw",
  "heb",
  "her",
  "hil",
  "him",
  "hin",
  "hit",
  "hmn",
  "hmo",
  "hrv",
  "hsb",
  "hun",
  "hup",
  "hye",
  "iba",
  "ibo",
  "ido",
  "iii",
  "ijo",
  "iku",
  "ile",
  "ilo",
  "ina",
  "inc",
  "ind",
  "ine",
  "inh",
  "ipk",
  "ira",
  "iro",
  "isl",
  "ita",
  "jav",
  "jbo",
  "jpn",
  "jpr",
  "jrb",
  "kaa",
  "kab",
  "kac",
  "kal",
  "kam",
  "kan",
  "kar",
  "kas",
  "kat",
  "kau",
  "kaw",
  "kaz",
  "kbd",
  "kha",
  "khi",
  "khm",
  "kho",
  "kik",
  "kin",
  "kir",
  "kmb",
  "kok",
  "kom",
  "kon",
  "kor",
  "kos",
  "kpe",
  "krc",
  "krl",
  "kro",
  "kru",
  "kua",
  "kum",
  "kur",
  "kut",
  "lad",
  "lah",
  "lam",
  "lao",
  "lat",
  "lav",
  "lez",
  "lim",
  "lin",
  "lit",
  "lol",
  "loz",
  "ltz",
  "lua",
  "lub",
  "lug",
  "lui",
  "lun",
  "luo",
  "lus",
  "mad",
  "mag",
  "mah",
  "mai",
  "mak",
  "mal",
  "man",
  "map",
  "mar",
  "mas",
  "mdf",
  "mdr",
  "men",
  "mga",
  "mic",
  "min",
  "mkd",
  "mkh",
  "mlg",
  "mlt",
  "mnc",
  "mni",
  "mno",
  "moh",
  "mon",
  "mos",
  "mri",
  "msa",
  "mun",
  "mus",
  "mwl",
  "mwr",
  "mya",
  "myn",
  "myv",
  "nah",
  "nai",
  "nap",
  "nau",
  "nav",
  "nbl",
  "nde",
  "ndo",
  "nds",
  "nep",
  "new",
  "nia",
  "nic",
  "niu",
  "nld",
  "nno",
  "nob",
  "nog",
  "non",
  "nor",
  "nqo",
  "nso",
  "nub",
  "nwc",
  "nya",
  "nym",
  "nyn",
  "nyo",
  "nzi",
  "oci",
  "oji",
  "ori",
  "orm",
  "osa",
  "oss",
  "ota",
  "oto",
  "paa",
  "pag",
  "pal",
  "pam",
  "pan",
  "pap",
  "pau",
  "peo",
  "phi",
  "phn",
  "pli",
  "pol",
  "pon",
  "por",
  "pra",
  "pro",
  "pus",
  "que",
  "raj",
  "rap",
  "rar",
  "roa",
  "roh",
  "rom",
  "ron",
  "run",
  "rup",
  "rus",
  "sad",
  "sag",
  "sah",
  "sai",
  "sal",
  "sam",
  "san",
  "sas",
  "sat",
  "scn",
  "sco",
  "sel",
  "sem",
  "sga",
  "sgn",
  "shn",
  "sid",
  "sin",
  "sio",
  "sit",
  "sla",
  "slk",
  "slv",
  "sma",
  "sme",
  "smi",
  "smj",
  "smn",
  "smo",
  "sms",
  "sna",
  "snd",
  "snk",
  "sog",
  "som",
  "son",
  "sot",
  "spa",
  "sqi",
  "srd",
  "srn",
  "srp",
  "srr",
  "ssa",
  "ssw",
  "suk",
  "sun",
  "sus",
  "sux",
  "swa",
  "swe",
  "syc",
  "syr",
  "tah",
  "tai",
  "tam",
  "tat",
  "tel",
  "tem",
  "ter",
  "tet",
  "tgk",
  "tgl",
  "tha",
  "tig",
  "tir",
  "tiv",
  "tkl",
  "tlh",
  "tli",
  "tmh",
  "tog",
  "ton",
  "tpi",
  "tsi",
  "tsn",
  "tso",
  "tuk",
  "tum",
  "tup",
  "tur",
  "tut",
  "tvl",
  "twi",
  "tyv",
  "udm",
  "uga",
  "uig",
  "ukr",
  "umb",
  "urd",
  "uzb",
  "vai",
  "ven",
  "vie",
  "vol",
  "vot",
  "wak",
  "wal",
  "war",
  "was",
  "wen",
  "wln",
  "wol",
  "xal",
  "xho",
  "yao",
  "yap",
  "yid",
  "yor",
  "ypk",
  "zap",
  "zbl",
  "zen",
  "zgh",
  "zha",
  "zho",
  "znd",
  "zul",
  "zun",
  "zza",
];

export default ISO639_PART2_ALPHA3_CODES;
