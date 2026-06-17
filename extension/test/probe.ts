import { JsonlIndexer } from '../src/indexer';

async function main() {
  const file = process.argv[2];
  const idx = new JsonlIndexer(file, file.split('/').pop()!);

  const t0 = Date.now();
  const meta = await idx.init(() => {});
  console.log(`init: ${meta.totalRows} rows, ${(meta.byteSize / 1e6).toFixed(1)}MB in ${Date.now() - t0}ms`);
  console.log(`columns (${meta.columns.length}):`, meta.columns.slice(0, 6).join(', '), '…');

  const page = await idx.getRows(0, 3);
  console.log(`getRows(0,3): first text =`, (page[0] as any)?.tweet_data?.text?.slice(0, 60));

  const far = await idx.getRowsByIndices([0, 50000, meta.totalRows - 1]);
  console.log(`getRowsByIndices: last row author =`, (far[2] as any)?.author_data?.username);

  const t1 = Date.now();
  const search = await idx.query({ search: 'claude code' }, () => {});
  console.log(`query search "claude code": ${search.matched} matches in ${Date.now() - t1}ms`);

  const t2 = Date.now();
  const sorted = await idx.query(
    { sort: { path: 'tweet_data.public_metrics.like_count', dir: 'desc' } },
    () => {},
  );
  const top = await idx.getRowsByIndices(sorted.order!.slice(0, 5));
  console.log(
    `query sort like_count desc in ${Date.now() - t2}ms; top5 likes =`,
    top.map((r: any) => r.tweet_data?.public_metrics?.like_count),
  );

  const t3 = Date.now();
  const filtered = await idx.query(
    { filters: [{ path: 'author_data.verified', op: 'eq', value: 'true' }] },
    () => {},
  );
  console.log(`query filter verified=true: ${filtered.matched} matches in ${Date.now() - t3}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
