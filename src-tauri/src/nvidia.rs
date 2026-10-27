// NVIDIA's public driver lookup service, plus artwork lookups for the UI.
use regex::Regex;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

pub const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36";
const LOOKUP_API: &str = "https://www.nvidia.com/Download/API/lookupValueSearch.aspx";
const DRIVER_API: &str = "https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php";
const OS_WINDOWS_11: u32 = 135;
const OS_WINDOWS_10_64: u32 = 57;

pub fn client() -> &'static reqwest::Client {
    static C: OnceLock<reqwest::Client> = OnceLock::new();
    C.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(UA)
            .timeout(Duration::from_secs(25))
            .build()
            .expect("http client")
    })
}

async fn get_text(url: &str) -> Result<String, String> {
    let res = client().get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {} from {}", res.status().as_u16(), host(url)));
    }
    res.text().await.map_err(|e| e.to_string())
}

fn host(url: &str) -> &str {
    url.split("//").nth(1).and_then(|r| r.split('/').next()).unwrap_or(url)
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub pfid: u32,
    pub psid: u32,
    pub name: String,
    pub series: String,
}

fn decode_xml(s: &str) -> String {
    s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
}

fn parse_lookup(xml: &str) -> Vec<(u32, String, u32)> {
    let re = Regex::new(r#"<LookupValue[^>]*\bParentID="(\d+)"[^>]*>\s*<Name>([^<]*)</Name>\s*<Value>(\d+)</Value>"#).unwrap();
    re.captures_iter(xml)
        .filter_map(|c| Some((c[1].parse().ok()?, decode_xml(&c[2]), c[3].parse().ok()?)))
        .collect()
}

static CATALOG: Mutex<Option<Arc<Vec<Product>>>> = Mutex::new(None);

// Product families (TypeID=3) carry their series id as ParentID; series (TypeID=2) give the series names.
pub async fn catalog() -> Result<Arc<Vec<Product>>, String> {
    if let Some(c) = CATALOG.lock().unwrap().as_ref() {
        return Ok(c.clone());
    }
    let series_url = format!("{LOOKUP_API}?TypeID=2");
    let product_url = format!("{LOOKUP_API}?TypeID=3");
    let (series_xml, product_xml) = tokio::try_join!(get_text(&series_url), get_text(&product_url))?;
    let series: HashMap<u32, String> = parse_lookup(&series_xml).into_iter().map(|(_, n, v)| (v, n)).collect();
    let products: Vec<Product> = parse_lookup(&product_xml)
        .into_iter()
        .map(|(parent, name, value)| Product {
            pfid: value,
            psid: parent,
            series: series.get(&parent).cloned().unwrap_or_default(),
            name,
        })
        .collect();
    let arc = Arc::new(products);
    *CATALOG.lock().unwrap() = Some(arc.clone());
    Ok(arc)
}

fn normalize_gpu(name: &str) -> String {
    let re = Regex::new(r"(?i)^nvidia\s+|\s+(laptop gpu|laptop|with max-q design|max-q)$").unwrap();
    re.replace_all(name.trim(), "").split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()
}

fn is_notebook_series(series: &str) -> bool {
    let s = series.to_lowercase();
    s.contains("notebook") || s.contains("laptop") || s.contains("mobile")
}

pub async fn match_product(gpu_name: &str, notebook: bool) -> Result<Option<Product>, String> {
    let products = catalog().await?;
    let wanted = normalize_gpu(gpu_name);
    let candidates: Vec<&Product> = products.iter().filter(|p| normalize_gpu(&p.name) == wanted).collect();
    Ok(candidates
        .iter()
        .find(|p| is_notebook_series(&p.series) == notebook)
        .or(candidates.first())
        .map(|p| (*p).clone()))
}

pub async fn search_products(query: &str) -> Result<Vec<Product>, String> {
    let products = catalog().await?;
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(vec![]);
    }
    Ok(products
        .iter()
        .filter(|p| p.name.to_lowercase().contains(&q) || p.series.to_lowercase().contains(&q))
        .take(40)
        .cloned()
        .collect())
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Driver {
    pub id: String,
    pub name: String,
    pub version: String,
    pub branch: Option<String>,
    pub release_date: Option<String>,
    pub is_studio: bool,
    pub is_whql: bool,
    pub is_beta: bool,
    pub size: String,
    pub download_url: String,
    pub details_url: String,
    pub headline: String,
    pub notes_html: String,
    pub other_notes_html: String,
    pub release_notes_pdf: Option<String>,
    pub article_url: Option<String>,
    pub banner_image: Option<String>,
    pub billboard_url: Option<String>,
    pub games: Vec<String>,
}

fn dec(v: &Value) -> String {
    let s = v.as_str().unwrap_or("");
    urlencoding::decode(s).map(|c| c.into_owned()).unwrap_or_else(|_| s.to_string())
}

fn s(v: &Value) -> String {
    v.as_str().unwrap_or("").to_string()
}

fn release_date(s: &str) -> Option<String> {
    let re = Regex::new(r"([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})").unwrap();
    let c = re.captures(s)?;
    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let m = months.iter().position(|m| *m == &c[1])? + 1;
    Some(format!("{}-{:02}-{:02}", &c[3], m, c[2].parse::<u32>().ok()?))
}

pub fn strip_tags(html: &str) -> String {
    let re = Regex::new(r"<[^>]+>").unwrap();
    let t = re.replace_all(html, " ").replace("&amp;", "&").replace("&nbsp;", " ").replace("&#39;", "'").replace("&quot;", "\"");
    t.split_whitespace().collect::<Vec<_>>().join(" ")
}

// "...supporting DLSS and RTX technologies including Phantom Blade Zero, Call of Duty: Modern Warfare 4, and NBA 2K27."
fn extract_games(notes: &str) -> Vec<String> {
    let text = strip_tags(notes);
    let including = Regex::new(r"(?i)\bincluding\s+(.+?)\.(?:\s|$)").unwrap();
    let title = Regex::new(r"(?i)Game Ready for\s+(.+?)\s+This new").unwrap();
    let list = if let Some(c) = including.captures(&text) {
        c[1].to_string()
    } else if let Some(c) = title.captures(&text) {
        c[1].replace(" & ", ", ")
    } else {
        return vec![];
    };
    let split = Regex::new(r"(?i),\s*(?:and\s+)?|\s+and\s+").unwrap();
    let mut out: Vec<String> = Vec::new();
    for n in split.split(&list) {
        let n = n.trim().trim_start_matches("the latest ").trim().to_string();
        if n.len() > 1 && n.len() < 70 && !out.contains(&n) {
            out.push(n);
        }
    }
    out.truncate(10);
    out
}

fn first(re: &str, text: &str) -> Option<String> {
    Regex::new(re).ok()?.captures(text).map(|c| c[1].to_string())
}

fn parse_driver(d: &Value) -> Driver {
    let notes = dec(&d["ReleaseNotes"]);
    let other = dec(&d["OtherNotes"]);
    let article = first(r#"(?i)href="(https://www\.nvidia\.com/[^"]*/news/[^"]+)""#, &notes);
    Driver {
        id: s(&d["ID"]),
        name: dec(&d["Name"]),
        version: s(&d["Version"]),
        branch: d["Release"].as_str().filter(|r| !r.is_empty()).map(|r| format!("R{r}")),
        release_date: release_date(&s(&d["ReleaseDateTime"])),
        is_studio: s(&d["IsCRD"]) == "1",
        is_whql: s(&d["IsWHQL"]) == "1",
        is_beta: s(&d["IsBeta"]) == "1",
        size: s(&d["DownloadURLFileSize"]),
        download_url: s(&d["DownloadURL"]),
        details_url: s(&d["DetailsURL"]),
        headline: first(r"(?i)<b>([^<]+)</b>", &notes).map(|h| decode_xml(h.trim())).unwrap_or_else(|| dec(&d["Name"])),
        release_notes_pdf: first(r#"(?i)href="([^"]+\.pdf)""#, &other),
        banner_image: first(r#"(?i)<img[^>]+src="([^"]+)""#, &notes),
        billboard_url: d["BannerURL"].as_str().filter(|u| u.starts_with("https://")).map(String::from),
        article_url: article,
        games: extract_games(&notes),
        notes_html: notes,
        other_notes_html: other,
    }
}

pub async fn lookup_drivers(psid: u32, pfid: u32, windows11: bool, studio: bool, count: u32) -> Result<Vec<Driver>, String> {
    let os = if windows11 { OS_WINDOWS_11 } else { OS_WINDOWS_10_64 };
    // Game Ready answers under the WHQL filter; Studio only answers with upCRD=1 and no WHQL flag.
    let channel = if studio { "&upCRD=1" } else { "&isWHQL=1&upCRD=0" };
    let url = format!(
        "{DRIVER_API}?func=DriverManualLookup&psid={psid}&pfid={pfid}&osID={os}&languageCode=1033&dch=1&sort1=0&numberOfResults={count}{channel}"
    );
    let body = get_text(&url).await?;
    let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    if json["Success"].as_str() == Some("0") {
        return Ok(vec![]);
    }
    Ok(json["IDS"]
        .as_array()
        .map(|a| a.as_slice())
        .unwrap_or(&[])
        .iter()
        .map(|x| &x["downloadInfo"])
        .filter(|d| d["Success"].as_str() == Some("1") && d["Version"].as_str().is_some())
        .map(parse_driver)
        .filter(|d| d.is_studio == studio)
        .collect())
}

#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ArticleMeta {
    pub image: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
}

static ARTICLES: Mutex<Option<HashMap<String, ArticleMeta>>> = Mutex::new(None);

fn meta(html: &str, prop: &str) -> Option<String> {
    first(&format!(r#"(?i)<meta[^>]+property="{prop}"[^>]+content="([^"]+)""#), html)
        .or_else(|| first(&format!(r#"(?i)<meta[^>]+content="([^"]+)"[^>]+property="{prop}""#), html))
        .map(|v| decode_xml(&v))
}

pub async fn article_meta(url: &str) -> ArticleMeta {
    if let Some(m) = ARTICLES.lock().unwrap().as_ref().and_then(|c| c.get(url)) {
        return m.clone();
    }
    let result = match get_text(url).await {
        Ok(html) => ArticleMeta {
            image: meta(&html, "og:image"),
            title: meta(&html, "og:title"),
            description: meta(&html, "og:description"),
        },
        Err(_) => return ArticleMeta::default(),
    };
    ARTICLES.lock().unwrap().get_or_insert_with(HashMap::new).insert(url.to_string(), result.clone());
    result
}

// The driver's "billboard" is a small NVIDIA page holding one piece of release artwork.
pub async fn billboard_image(url: &str) -> Option<String> {
    let key = format!("billboard:{url}");
    if let Some(m) = ARTICLES.lock().unwrap().as_ref().and_then(|c| c.get(&key)) {
        return m.image.clone();
    }
    let html = get_text(url).await.ok()?;
    let src = first(r#"(?i)(?:src|href|content)="((?:https:)?//images\.nvidia\.com/[^"]+\.(?:jpg|png|webp))""#, &html)?;
    let image = if src.starts_with("//") { format!("https:{src}") } else { src };
    ARTICLES.lock().unwrap().get_or_insert_with(HashMap::new)
        .insert(key, ArticleMeta { image: Some(image.clone()), ..Default::default() });
    Some(image)
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GameArt {
    pub query: String,
    pub name: String,
    pub image: Option<String>,
    pub hero: Option<String>,
    pub description: Option<String>,
    pub store_url: Option<String>,
}

// Newer Steam apps keep artwork under hashed paths; this API returns them.
async fn steam_assets(id: u64) -> Option<Value> {
    let input = format!(
        r#"{{"ids":[{{"appid":{id}}}],"context":{{"language":"english","country_code":"US"}},"data_request":{{"include_assets":true}}}}"#
    );
    let url = format!("https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json={}", urlencoding::encode(&input));
    let json: Value = serde_json::from_str(&get_text(&url).await.ok()?).ok()?;
    Some(json["response"]["store_items"][0]["assets"].clone())
}

fn asset_url(assets: &Value, key: &str) -> Option<String> {
    let format = assets["asset_url_format"].as_str()?;
    let file = assets[key].as_str()?;
    Some(format!("https://shared.akamai.steamstatic.com/store_item_assets/{}", format.replace("${FILENAME}", file)))
}

static GAMES: Mutex<Option<HashMap<String, GameArt>>> = Mutex::new(None);

fn simplify(s: &str) -> String {
    s.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect()
}

pub async fn game_art(name: &str) -> GameArt {
    if let Some(g) = GAMES.lock().unwrap().as_ref().and_then(|c| c.get(name)) {
        return g.clone();
    }
    let mut result = GameArt { query: name.into(), name: name.into(), image: None, hero: None, description: None, store_url: None };
    let search_url = format!("https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US", urlencoding::encode(name));
    if let Ok(body) = get_text(&search_url).await {
        let json: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
        let want = simplify(name);
        let hit = json["items"].as_array().and_then(|items| {
            items.iter().find(|i| {
                let got = simplify(i["name"].as_str().unwrap_or(""));
                !got.is_empty() && (got == want || got.starts_with(&want) || want.starts_with(&got))
            })
        });
        if let Some(hit) = hit {
            let id = hit["id"].as_u64().unwrap_or(0);
            result.store_url = Some(format!("https://store.steampowered.com/app/{id}/"));
            result.name = hit["name"].as_str().unwrap_or(name).to_string();
            result.image = hit["tiny_image"].as_str().map(String::from);
            let details_url = format!("https://store.steampowered.com/api/appdetails?appids={id}&filters=basic&l=english");
            if let Ok(body) = get_text(&details_url).await {
                let details: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
                let data = &details[id.to_string()]["data"];
                if let Some(img) = data["header_image"].as_str() {
                    result.image = Some(img.to_string());
                }
                if let Some(n) = data["name"].as_str() {
                    result.name = n.to_string();
                }
                result.description = data["short_description"].as_str().map(strip_tags);
            }
            if let Some(assets) = steam_assets(id).await {
                result.hero = asset_url(&assets, "library_hero").or_else(|| asset_url(&assets, "raw_page_background"));
                if let Some(header) = asset_url(&assets, "header") {
                    result.image = Some(header);
                }
            }
        }
    }
    GAMES.lock().unwrap().get_or_insert_with(HashMap::new).insert(name.to_string(), result.clone());
    result
}
