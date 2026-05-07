package com.shubham_singh.ai_architect.controller;

import com.shubham_singh.ai_architect.service.GeminiService;
import com.shubham_singh.ai_architect.service.GithubService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// @RestController tells Spring: "This class is a waiter. It handles web requests."
@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class ArchitectController {
    private final GithubService githubService;
    private final GeminiService geminiService;

    public ArchitectController(GithubService githubService, GeminiService geminiService) {
        this.githubService = githubService;
        this.geminiService = geminiService;
    }

    @GetMapping("/test/health")
    public String testHealth(){
        return "Hello there, Server is running";
    }

    // Helper method to turn "https://github.com/owner/repo" into ["owner", "repo"]
    private String[] extractOwnerAndRepo(String url) {
        String cleanUrl = url.replaceFirst("^(https?://)?(www\\.)?github\\.com/", "");
        String[] parts = cleanUrl.split("/");
        if (parts.length >= 2) {
            return new String[]{parts[0], parts[1]};
        }
        throw new IllegalArgumentException("Invalid GitHub URL format");
    }

    // NEW DYNAMIC ENDPOINT 1: The Map
    @GetMapping("/api/analyze")
    public String analyzeRepo(@RequestParam String repoUrl, @RequestParam(defaultValue = "main") String branch) {
        String[] parts = extractOwnerAndRepo(repoUrl);
        String owner = parts[0];
        String repo = parts[1];

        // Pass the dynamic branch instead of "main"
        String treeJson = githubService.getRepositoryTree(owner, repo, branch);
        return geminiService.analyzeRepositoryTree(treeJson);
    }

    // 2. Update the Deep-Dive Endpoint
    @GetMapping("/api/deep-dive")
    public Map<String, String> getDeepDive(
            @RequestParam String repoUrl,
            @RequestParam String path,
            @RequestParam(defaultValue = "main") String branch) {

        String[] parts = extractOwnerAndRepo(repoUrl);
        String owner = parts[0];
        String repo = parts[1];

        // Pass the branch to the updated getFileContent method
        String rawCode = githubService.getFileContent(owner, repo, path, branch);
        String explanation = geminiService.generateDeepDive(path, rawCode);

        return Map.of(
                "code", rawCode,
                "explanation", explanation
        );
    }

    @GetMapping("/api/tree")
    public String getRepoTree(@RequestParam String repoUrl, @RequestParam(defaultValue = "main") String branch) {
        String[] parts = extractOwnerAndRepo(repoUrl);
        // Returns the raw GitHub JSON tree
        return githubService.getRepositoryTree(parts[0], parts[1], branch);
    }

    @GetMapping("/api/file")
    public Map<String, String> getFileContent(@RequestParam String repoUrl, @RequestParam String path, @RequestParam(defaultValue = "main") String branch) {
        String[] parts = extractOwnerAndRepo(repoUrl);
        String rawCode = githubService.getFileContent(parts[0], parts[1], path, branch);
        return Map.of("code", rawCode);
    }

    @GetMapping("/api/analyze-file")
    public Map<String, String> analyzeFile(@RequestParam String repoUrl, @RequestParam String path, @RequestParam(defaultValue = "main") String branch) {
        String[] parts = extractOwnerAndRepo(repoUrl);
        String rawCode = githubService.getFileContent(parts[0], parts[1], path, branch);
        String explanation = geminiService.generateDeepDive(path, rawCode);
        return Map.of("explanation", explanation);
    }

    // 4. The Interactive Chatbot Endpoint
    @GetMapping("/api/chat-file")
    public Map<String, String> chatAboutFile(
            @RequestParam String repoUrl,
            @RequestParam String path,
            @RequestParam(defaultValue = "main") String branch,
            @RequestParam String prompt) { // <-- The new user question

        // 1. Extract the owner and repo from the URL
        String[] parts = extractOwnerAndRepo(repoUrl);
        String owner = parts[0];
        String repo = parts[1];

        // 2. Fetch the latest code so the AI has context
        String rawCode = githubService.getFileContent(owner, repo, path, branch);

        // 3. Pass the code AND the user's question to Gemini
        String answer = geminiService.answerCodeQuestion(path, rawCode, prompt);

        // 4. Return the answer to React
        return Map.of("explanation", answer);
    }
}
