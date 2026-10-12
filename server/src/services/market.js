// Live market data from CoinGecko, normalized into the app's internal shapes.
import { config } from '../config.js';
import { cached } from '../cache.js';
import { fetchJson } from '../http.js';

const BASE = config.coingeckoPro ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';

function cg(path) {
  const headers = {};
  if (config.coingeckoKey) headers[config.coingeckoPro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = config.coingeckoKey;
  return fetchJson(BASE + path, { headers, timeout: 12000 });
}

const stripHtml = (s) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function normMarket(c) {
  return {
    id: c.id,
    symbol: (c.symbol || '').toUpperCase(),
    name: c.name,
    image: c.image,
    price: c.current_price,
    marketCap: c.market_cap,
    rank: c.market_cap_rank,
    volume24h: c.total_volume,
    high24h: c.high_24h,
    low24h: c.low_24h,
    change1h: c.price_change_percentage_1h_in_currency ?? null,
    change24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
    change7d: c.price_change_percentage_7d_in_currency ?? null,
    change30d: c.price_change_percentage_30d_in_currency ?? null,
    ath: c.ath,
    athChangePct: c.ath_change_percentage,
    circulatingSupply: c.circulating_supply,
    maxSupply: c.max_supply,
    sparkline: c.sparkline_in_7d?.price || [], // ~168 hourly points
    lastUpdated: c.last_updated,
  };
}

function normCoin(d) {
  const m = d.market_data || {};
  return {
    id: d.id,
    symbol: (d.symbol || '').toUpperCase(),
    name: d.name,
    image: d.image?.large || d.image?.small,
    price: m.current_price?.usd,
    marketCap: m.market_cap?.usd,
    rank: d.market_cap_rank,
    volume24h: m.total_volume?.usd,
    high24h: m.high_24h?.usd,
    low24h: m.low_24h?.usd,
    change1h: m.price_change_percentage_1h_in_currency?.usd ?? null,
    change24h: m.price_change_percentage_24h ?? null,
    change7d: m.price_change_percentage_7d ?? null,
    change30d: m.price_change_percentage_30d ?? null,
    ath: m.ath?.usd,
    athChangePct: m.ath_change_percentage?.usd,
    circulatingSupply: m.circulating_supply,
    maxSupply: m.max_supply,
    description: stripHtml(d.description?.en || '').slice(0, 700),
    homepage: d.links?.homepage?.find(Boolean) || null,
    subreddit: (d.links?.subreddit_url || '').match(/reddit\.com\/r\/([^/]+)/i)?.[1] || null,
    categories: (d.categories || []).filter(Boolean).slice(0, 5),
    votesUpPct: d.sentiment_votes_up_percentage ?? null,
    community: {
      redditSubscribers: d.community_data?.reddit_subscribers || null,
      twitterFollowers: d.community_data?.twitter_followers || null,
      telegramUsers: d.community_data?.telegram_channel_user_count || null,
    },
    genesisDate: d.genesis_date,
  };
}

export const getMarkets = (n) =>
  cached(`markets:${n}`, 3 * 60_000, async () => {
    const data = await cg(
      `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${n}&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d`
    );
    return data.map(normMarket);
  });

export const getCoin = (id) =>
  cached(`coin:${id}`, 10 * 60_000, async () =>
    normCoin(
      await cg(
        `/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`
      )
    )
  );

export const getHistory = (id, days) =>
  cached(`hist:${id}:${days}`, days <= 1 ? 15 * 60_000 : 30 * 60_000, async () => {
    const d = await cg(`/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}${days > 90 ? '&interval=daily' : ''}`);
    return { prices: d.prices || [], volumes: d.total_volumes || [] };
  });

export const getTrending = () =>
  cached('trending', 15 * 60_000, async () => {
    const d = await cg('/search/trending');
    return (d.coins || []).map(({ item }) => ({
      id: item.id,
      name: item.name,
      symbol: (item.symbol || '').toUpperCase(),
      thumb: item.small || item.thumb,
      marketCapRank: item.market_cap_rank,
    }));
  });

export const getGlobal = () =>
  cached('global', 15 * 60_000, async () => {
    const { data } = await cg('/global');
    return {
      totalMarketCap: data.total_market_cap?.usd,
      totalVolume: data.total_volume?.usd,
      btcDominance: data.market_cap_percentage?.btc,
      ethDominance: data.market_cap_percentage?.eth,
      marketCapChange24h: data.market_cap_change_percentage_24h_usd,
      activeCryptos: data.active_cryptocurrencies,
    };
  });
