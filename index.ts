interface GitLabGetImages {
    data: {
        containerRepository: {
            tags: {
                edges: [{
                    node: {
                        name: string,
                    },
                }]
            }
        }
    }
}

interface GitLabGetPipelineCount {
    data: {
        project: {
            pipelines: {
                count: number;
            }
        }
    }
}


interface GitLabError {
    errors: {
        message: string;
    }[]
}

interface GitHubRelease {
    tag_name: string;
    prerelease: boolean;
    draft: boolean;
}

interface GitLabPipelineResponse {
    web_url: string;
}

interface GitLabInstance {
    domain: string;
    token: string;
}

async function runGitLabQuery<T extends Exclude<object, GitLabError>>(operationName: string, inst: GitLabInstance, query: string, variables: Record<string,unknown>) {
    const response = await fetch(`https://${inst.domain}/api/graphql`, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${inst.token}`,
        },
        body: JSON.stringify({
            operationName,
            query,
            variables,
        }),
        method: "POST",
    });
    const result = await response.json() as GitLabError|T;
    // GraphGL doesn't use statuses...grrr.
    if (!response.ok || 'errors' in result) {
        const error = result as GitLabError;
        throw Error(`Got a ${response.status} from GitLab: ${error.errors.map((e: any) => e.message).join('\n\t')}`)
    }
    return result;

}

async function getExistingGitLabInfo(inst: GitLabInstance, fullPath: string, imageName: string, containerRepositoryName = ""): Promise<{
    images: string[], defaultBranch: string}> {
    const query = `
    query getImageRepository($fullPath: ID!){
        project(fullPath: $fullPath) {
            containerRepositories(first: 5) {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
            default_branch
        }
    }
    query getImages($id: ContainerRepositoryID!, $name: String!) {
        containerRepository(id: $id) {
            tags(name: $name) {
                edges {
                    node {
                        name
                    }
                }
            }
        }
    }`;
    const { data: { project }} = await runGitLabQuery<{data: {project: {
        containerRepositories: { edges: [{node: {name: string, id: string}}]},
        default_branch: string,
    }}}>("getImageRepository", inst, query, {
        fullPath,
    });
    const repository = project.containerRepositories.edges.find(e => e.node.name === containerRepositoryName)?.node.id;
    if (!repository) {
        throw Error('No repository found for project , does it contain container images');
    }
    const variables = {
        name: imageName,
        id: repository,
    }
    const result = await runGitLabQuery<GitLabGetImages>("getImages", inst, query, variables);
    return {
        images: result.data.containerRepository.tags.edges.map(n => n.node.name),
        defaultBranch: project.default_branch,
    };
}

async function getRunningPipelines(inst: GitLabInstance, fullPath: string): Promise<number> {
    const query = `query getRunningPipelines($fullPath: ID!) {
        project(fullPath: $fullPath) {
          pipelines(first: 5, status: RUNNING) {
            count
          }
        }
      }`;
    const variables = {
        fullPath,
    }
    const result = await runGitLabQuery<GitLabGetPipelineCount>("getRunningPipelines", inst, query, variables);
    return result.data.project.pipelines.count;
}

async function getLatestGitHubImage(repository: string): Promise<string> {
    const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=10`);
    if (!response.ok) {
        throw Error(`Got a ${response.status} from GitHub: ${await response.text()}`);
    }
    const releases = await response.json() as GitHubRelease[];
    const latest = releases.filter(r => !r.prerelease && !r.draft).map(r => r.tag_name).sort().reverse()[0];
    if (!latest) {
        throw Error('Could not determine latest release.')
    }
    return latest;
}

async function startPipeline(inst: GitLabInstance, projectId: string, ref: string, variables: Record<string, string>): Promise<string> {
    const response = await fetch(`https://${inst.domain}/api/v4/projects/${encodeURIComponent(projectId)}/pipeline?ref=${encodeURIComponent(ref)}`, {
        headers: {
            "Content-Type": "application/json",
            "PRIVATE-TOKEN": inst.token,
        },
        body: JSON.stringify({
            variables: Object.entries(variables).map(([key, value]) => ({key, value})),
        }),
        method: "POST",
    });
    if (!response.ok) {
        throw Error(`Got a ${response.status} from GitLab: ${await response.text()}`);
    }
    const result = await response.json() as GitLabPipelineResponse;
    return result.web_url;
}

async function main() {
    // github repo, projectName, containerPath, token
    const gitlabToken = process.env.GITLAB_TOKEN;
    if (!gitlabToken) {
        throw Error('GITLAB_TOKEN is not set in env vars.');
    }
    const gitlabDomain = process.env.GITLAB_DOMAIN;
    if (!gitlabDomain) {
        throw Error('GITLAB_DOMAIN is not set in env vars.');
    }

    const projects = process.env.AUTOTRIGGER_PROJECTS?.trim().split(',').map(v => {
        const parts = v.trim().split('|');
        if (!parts[0] || !parts[1]) {
            throw Error('Projects is misconfigured');
        }
        return {
            githubRepo: parts[0],
            gitlabProject: parts[1],
            containerName: parts[2] ?? '',
            tagVariableName: parts[3] ?? 'TAG_NAME',
            // A sequence of foo=bar,bar=baz
            extraVariables: Object.fromEntries((parts[4] ?? '').split(',').filter(s => !!s).map(s => s.split('=')))
        }
    });
    if (!projects || projects.length === 0) {
        throw Error('AUTOTRIGGER_PROJECTS is not set in env vars.');
    }

    const gitlabInstance: GitLabInstance = {
        token: gitlabToken,
        domain: gitlabDomain,
    }

    let didFail = false;

    for (const project of projects) {
        try {
            console.log(`Checking ${project.githubRepo}`);
            const latestTag = await getLatestGitHubImage(project.githubRepo);
            console.log(`Determined latest tag is ${latestTag}`);
            const { images: latestImages, defaultBranch } = await getExistingGitLabInfo(gitlabInstance, project.gitlabProject, latestTag, project.containerName);
        
            if (latestImages.length) {
                console.log(`Determined latest images are ${latestImages}`);
            } else {
                console.log(`No images match latest tag name`);
            }
            if (latestImages.includes(latestTag)) {
                console.log('☑️ All up to date');
                continue;
            } else {
                console.log('🆕 New image found');
            }
            if (await getRunningPipelines(gitlabInstance, project.gitlabProject) > 0) {
                console.log('⏳ Some pipelines are still running, skipping');
                continue;
            }
        
            const url = await startPipeline(gitlabInstance, project.gitlabProject, defaultBranch, {
                [project.tagVariableName]: latestTag,
                ...project.extraVariables
            });
            console.log(`🆕 New build started at ${url}`);
        } catch (ex) {
            console.error(`Failed to handle ${project.githubRepo} / ${project.gitlabProject}`, ex);
            didFail = true;
        }
    }
    if (didFail) {
        throw Error('At least one project failed');
    }
}

main().then(() => {
    process.exit(0);
}).catch((ex) => {
    console.error(`Failed to run check`, ex);
    process.exit(1);
})