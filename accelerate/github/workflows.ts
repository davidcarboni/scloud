import { Octokit } from '@octokit/rest';
import { SQS } from 'aws-sdk';
import { deleteItem, findItems } from './dynamodb';
import { listRepos } from './org';

// Values from /secrets/github.sh
const owner = process.env.OWNER || process.env.USERNAME || '';
const personalAccessToken = process.env.PERSONAL_ACCESS_TOKEN;

const octokit = new Octokit({
  auth: personalAccessToken,
});

let metricCount = 0;

async function sendMetric(metric: any) {
  const queueUrl = process.env.METRICS_QUEUE;
  if (queueUrl) {
    await new SQS().sendMessage({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(metric),
    }).promise();
  } else {
    // console.log(JSON.stringify(metric));
  }
  metricCount += 1;
}

async function processRun(run: any) {
  const {
    repository: repo,
    head_branch: branch,
    name,
    path,
    actor,
    event,
    triggering_actor: triggeringActor,
    status,
    conclusion,
    created_at: created,
    updated_at: updated,
    head_sha: commitHash,
    html_url: url,
  } = run;
  const workflow = path || name;
  const user = (triggeringActor || actor).login;
  const repository = repo.name;

  // Cycle time
  let cycleTime;
  if (created && updated) {
    // Start/end in seconds
    const start = Math.floor(new Date(created).getTime() / 1000);
    const end = Math.floor(new Date(updated).getTime() / 1000);
    cycleTime = end - start;
  }

  if (['master', 'main'].includes(branch) && status === 'completed' && conclusion === 'success' && event !== 'schedule') {
    const metric = {
      date: updated || created,
      metric: 'github.build',
      repository,
      workflow,
      branch,
      user,
      status,
      conclusion,
      cycleTime,
      commitHash,
      url,
    };
    console.log(`status=${status} conclusion=${conclusion} event=${event} ${metric.date}`);
    await sendMetric(metric);
  } else {
    // console.log(`  ${repository}[${branch}]/${status}/${conclusion}/${event} ${workflow}`);
    // console.log(`${repository}[${branch}]/${workflow} ${user} ${status}/${conclusion}
    // - ${updated || created} - ${commitHash}`);
  }
}

export async function processRepo(repo: string) {
  const promises: Promise<any>[] = [];

  let page = 1;
  let count: number;
  let retrieved = 0;
  // let example = false;

  console.log(`Listing workflow runs on ${owner}/${repo}`);

  do {
    // eslint-disable-next-line no-await-in-loop
    const result: any = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      page,
    });

    // if (!example) {
    //   console.log(Object.keys(result.data));
    //   console.log(`total_count: ${result.data.total_count}`);
    //   console.log(Object.keys(result.data.workflow_runs[0]));
    //   console.log('\nRun:');
    //   Object.keys(result.data.workflow_runs[0]).forEach((key) => {
    //     console.log(`${key}: ${result.data.workflow_runs[0][key]}`);
    //   });
    //   console.log('\nTriggering actor:');
    //   Object.keys(result.data.workflow_runs[0].triggering_actor).forEach((key) => {
    //     console.log(`${key}: ${result.data.workflow_runs[0].triggering_actor[key]}`);
    //   });
    //   console.log('\nHead commit:');
    //   Object.keys(result.data.workflow_runs[0].head_commit).forEach((key) => {
    //     console.log(`${key}: ${result.data.workflow_runs[0].head_commit[key]}`);
    //   });
    //   example = true;
    // }

    result.data.workflow_runs.forEach((run: any) => promises.push(processRun(run)));

    count = result.data.workflow_runs.length;
    retrieved += count;
    console.log(`Page ${page}: ${retrieved}/${result.data.total_count} (+${count}) metrics: ${metricCount}`);
    page += 1;
  } while (count > 0);
}

export async function deleteMetrics(tableName: string) {
  const promises: Promise<any>[] = [];
  const items = await findItems(tableName, { name: 'metric', value: 'github.build' }, { name: 'dateSort', value: '20' });
  items.forEach((item) => {
    if (item.metric && item.dateSort) {
      promises.push(deleteItem(tableName, {
        metric: item.metric,
        dateSort: item.dateSort,
      }));
    }
  });
  await Promise.all(promises);
  console.log(`Delteted ${items.length} build metrics`);
}

export async function showBuilds(tableName: string) {
  const promises: Promise<any>[] = [];
  const items = await findItems(tableName, { name: 'metric', value: 'github.build' }, { name: 'dateSort', value: '20' });
  const counts: any = {};
  const months: any = {};
  items.forEach((item) => {
    const {
      repository,
      workflow,
      dateSort,
      path,
    } = item;
    const month = dateSort.slice(0, 7);
    const w = workflow || path || JSON.stringify(item);

    counts[repository] = counts[repository] || {};
    counts[repository][w] = counts[repository][w] || 0;
    counts[repository][w] += 1;

    months[month] = months[month] || 0;
    months[month] += 1;
  });
  await Promise.all(promises);
  console.log(items.length);

  Object.keys(counts).forEach((key) => {
    console.log(`${key}:`);
    let total = 0;
    Object.keys(counts[key]).forEach((workflow) => {
      console.log(` - ${counts[key][workflow]}\t${workflow}`);
      total += counts[key][workflow];
    });
    console.log(`   ${total}`);
  });

  Object.keys(months).forEach((month) => {
    console.log(`${month}\t,\t${months[month]}`);
  });
}

(async () => {
  const tableName = process.env.METRICS_TABLE;

  // await deleteMetrics(tableName);

  // List all repos:
  console.log('Repos:');
  const repos = await listRepos(octokit, owner);
  repos.forEach((repo: any) => { console.log(repo); });

  try {
    // Process each repo
    const promises: Promise<any>[] = [];
    repos.forEach((repo) => promises.push(processRepo(repo)));
    await Promise.all(promises);
  } catch (err) {
    const e = err as any;
    if (e.response) {
      console.error(`${e.request.method}: ${e.request.url}`);
      console.error(`${e.response.status} ${JSON.stringify(e.response.data)}`);
    } else {
      console.error(err);
    }
  }
  console.log(`Metrics: ${metricCount}`);

  showBuilds(tableName);
})();
