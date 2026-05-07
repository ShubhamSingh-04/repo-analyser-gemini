package com.shubham_singh.ai_architect.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.ResponseEntity;

import java.util.Base64;

// @Service tells Spring: "This class handles business logic. Create one instance of it and keep it ready."
@Service
public class GithubService {

    private final RestClient restClient;

    @Value("${github.pat}")
    private String GITHUB_TOKEN;

    public GithubService() {
        // We configure our RestClient to always point to GitHub's API base URL
        this.restClient = RestClient.builder()
                .baseUrl("https://api.github.com")
                .defaultHeader("Accept", "application/vnd.github.v3+json")
                // ADD THIS LINE to authenticate all requests:
                .defaultHeader("Authorization", "Bearer " + GITHUB_TOKEN)
                // GitHub requires a User-Agent header
                .defaultHeader("User-Agent", "Repo-Insight-Architect")
                .build();
    }

    /**
     * This method fetches the entire folder structure of a GitHub repository.
     */
    public String getRepositoryTree(String owner, String repo, String branch) {
        // We build the specific URL path for the repository tree
        // The "?recursive=1" tells GitHub to open all folders and give us everything at once.
        String uri = String.format("/repos/%s/%s/git/trees/%s?recursive=1", owner, repo, branch);

        // We send a GET request and store the response as a simple String
        ResponseEntity<String> response = restClient.get()
                .uri(uri)
                .retrieve()
                .toEntity(String.class);

        return response.getBody();
    }

    public String getFileContent(String owner, String repo, String path, String branch) {
        // We add ?ref=branch to tell GitHub exactly which branch to look at
        String uri = String.format("/repos/%s/%s/contents/%s?ref=%s", owner, repo, path, branch);

        String jsonResponse = restClient.get()
                .uri(uri)
                .retrieve()
                .body(String.class);

        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonResponse);
            String encodedContent = root.path("content").asText().replaceAll("\\s", "");
            byte[] decodedBytes = java.util.Base64.getDecoder().decode(encodedContent);
            return new String(decodedBytes);
        } catch (Exception e) {
            return "Error decoding file content: " + e.getMessage();
        }
    }
}
