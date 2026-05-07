package com.shubham_singh.ai_architect.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

@Service
public class GeminiService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper; // Jackson's JSON parser
    private final String geminiUri = "/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=";

    @Value("${gemini.api.key}")
    private String apiKey;

    public GeminiService() {
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
        this.objectMapper = new ObjectMapper(); // Initialize the parser
    }

    public String analyzeRepositoryTree(String githubTreeJson) {

        String prompt = "You are a senior software architect. Analyze the following GitHub repository file tree. " +
                "Identify the 3 most crucial 'High-Signal' files a new developer should read first to understand the core architecture. " +
                "Return ONLY a JSON array of objects, with each object containing 'filePath' and 'reasoning'. " +
                "Do not use markdown formatting. \n\nTree: " + githubTreeJson;

        String requestBody = """
                {
                  "contents": [{
                    "parts":[{"text": "%s"}]
                  }]
                }
                """.formatted(prompt.replace("\"", "\\\""));

        String uri = geminiUri + apiKey;

        // Store the raw Google response
        String rawResponse = restClient.post()
                .uri(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(String.class);

        // Dig into the JSON to extract just the AI's text answer
        try {
            JsonNode rootNode = objectMapper.readTree(rawResponse);
            String cleanJsonArray = rootNode
                    .path("candidates")
                    .get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

            // Clean up any stray markdown block formatting (like ```json) the AI might have added
            return cleanJsonArray.replaceAll("^```json\\s*", "").replaceAll("\\s*```$", "").trim();

        } catch (Exception e) {
            System.err.println("Error parsing Gemini response: " + e.getMessage());
            return "[{\"error\": \"Failed to parse AI response\"}]";
        }
    }

    public String generateDeepDive(String fileName, String rawCode) {

        try {


            // The "First Principles" Prompt
            String prompt = String.format("""
                    You are a Master Software Architect. Analyze the following source code for the file '%s'.
                    Explain it using 'First Principles'. 
                    1. Purpose: What is the fundamental problem this file solves?
                    2. Logic Flow: How does data move through this specific logic?
                    3. Architectural Context: How does this fit into the broader system?
                    
                    Keep the explanation concise, technical, and use simple language.
                    
                    CODE:
                    %s
                    """, fileName, rawCode);

            String requestBody = """
                    {
                      "contents": [{
                        "parts":[{"text": "%s"}]
                      }]
                    }
                    """.formatted(prompt.replace("\"", "\\\"").replace("\n", "\\n"));

            String uri = geminiUri + apiKey;

            String rawResponse = restClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            JsonNode rootNode = objectMapper.readTree(rawResponse);
            return rootNode.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();

        } catch (HttpServerErrorException.ServiceUnavailable e) {
            // This catches the 503 error specifically
            return "The AI Architect is currently busy handling high demand. Please wait 30 seconds and try again.";
        } catch (Exception e) {
            // This catches other general errors (like 429 or parsing issues)
            return "Deep-dive failed: " + e.getMessage();
        }
    }

    // NEW METHOD: Answers specific follow-up questions about a file
    public String answerCodeQuestion(String path, String rawCode, String userPrompt) {
        String uri = "/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=" + apiKey;

        // We inject the code, the filename, AND the user's question into the prompt
        String engineeredPrompt = String.format(
                "You are an expert Software Architect pair-programming with a developer. " +
                        "The developer is currently looking at the file: %s\n\n" +
                        "Here is the exact source code for context:\n" +
                        "```\n%s\n```\n\n" +
                "The developer asked the following follow-up question: \"%s\"\n\n" +
                        "Answer their question clearly and concisely. If referencing code, use markdown code blocks.",
                path, rawCode, userPrompt
        );

        // We use a Map to cleanly format the JSON payload Google expects
        Map<String, Object> requestBody = Map.of(
                "contents", new Object[]{
                        Map.of("parts", new Object[]{
                                Map.of("text", engineeredPrompt)
                        })
                }
        );

        try {
            // Note: If you are using Spring's RestClient, your syntax might look slightly different,
            // but the logic is identical to your existing generateDeepDive method.
            String jsonResponse = restClient.post()
                    .uri(uri)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonResponse);
            return root.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText();

        } catch (Exception e) {
            e.printStackTrace();
            return "Error generating answer: " + e.getMessage();
        }
    }
}
