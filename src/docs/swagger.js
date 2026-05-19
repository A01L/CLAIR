const publicApiUrl = process.env.PUBLIC_API_URL || "http://localhost:3000";

export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Clair API",
    version: "1.0.0",
    description: "Clair backend API documentation"
  },
  servers: [
    {
      url: publicApiUrl,
      description: "API server"
    }
  ],
  tags: [
    { name: "Auth" },
    { name: "Channels" },
    { name: "Channel Prompts" },
    { name: "Appeals" },
    { name: "Assistant" },
    { name: "Profile" },
    { name: "Reports" },
    { name: "Search" },
    { name: "User Keys" },
    { name: "AI" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      channelApiKey: {
        type: "apiKey",
        in: "header",
        name: "x-channel-key"
      }
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" }
        }
      },
      Channel: {
        type: "object",
        properties: {
          id: { type: "integer", example: 27 },
          uid: { type: "integer", example: 1 },
          channel_key: { type: "string", nullable: true },
          name: { type: "string", example: "Main Website" },
          allowed_domain: {
            type: "string",
            nullable: true,
            example: "http://127.0.0.1:5500"
          },
          is_active: { type: "boolean", example: true },
          processing_status: {
            type: "string",
            enum: ["active", "paused"],
            example: "active"
          },
          processing_pause_reason: {
            type: "string",
            nullable: true,
            example: "Gemini API key not set"
          },
          processing_paused_at: {
            type: "string",
            format: "date-time",
            nullable: true
          },
          processing_resumed_at: {
            type: "string",
            format: "date-time",
            nullable: true
          },
          api_key_last4: {
            type: "string",
            nullable: true,
            example: "a91f"
          },
          created_at: { type: "string", format: "date-time" },
          updated_at: {
            type: "string",
            format: "date-time",
            nullable: true
          }
        }
      }
    }
  },
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "ali" },
                  password: { type: "string", example: "123456" },
                  full_name: { type: "string", example: "Ali K." },
                  email: { type: "string", example: "ali@mail.com" },
                  tg_push: { type: "boolean", example: false }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "User registered" },
          400: { description: "Validation error" },
          409: { description: "User already exists" },
          500: { description: "Server error" }
        }
      }
    },

    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "ali" },
                  password: { type: "string", example: "123456" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "JWT token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    access_token: {
                      type: "string",
                      example: "eyJhbGciOiJIUzI1NiIs..."
                    },
                    token_type: {
                      type: "string",
                      example: "Bearer"
                    }
                  }
                }
              }
            }
          },
          400: { description: "Username and password required" },
          401: { description: "Invalid username or password" }
        }
      }
    },

    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Current user" },
          401: { description: "Unauthorized" },
          404: { description: "User not found" }
        }
      }
    },

    "/api/auth/login-history": {
      get: {
        tags: ["Auth"],
        summary: "Get login history",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", example: 20 }
          }
        ],
        responses: {
          200: { description: "Login history" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/channels": {
      get: {
        tags: ["Channels"],
        summary: "Get my channels",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Channels list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Channel" }
                    }
                  }
                }
              }
            }
          },
          401: { description: "Unauthorized" }
        }
      },
      post: {
        tags: ["Channels"],
        summary: "Create channel",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "Main Website" },
                  allowed_domain: {
                    type: "string",
                    nullable: true,
                    example: "http://127.0.0.1:5500"
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "Channel created" },
          400: { description: "Channel name required" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/channels/{cid}": {
      get: {
        tags: ["Channels"],
        summary: "Get channel by id",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "cid",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        responses: {
          200: { description: "Channel found" },
          400: { description: "Invalid cid" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found" }
        }
      },
      patch: {
        tags: ["Channels"],
        summary: "Update channel",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "cid",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Updated Website" },
                  allowed_domain: {
                    type: "string",
                    example: "http://localhost:5173"
                  },
                  is_active: { type: "boolean", example: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Channel updated" },
          400: { description: "Nothing to update" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      },
      delete: {
        tags: ["Channels"],
        summary: "Delete channel",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "cid",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        responses: {
          200: { description: "Channel deleted" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      }
    },

    "/api/channels/{cid}/status": {
      patch: {
        tags: ["Channels"],
        summary: "Change channel processing status",
        description: "Changes processing_status between active and paused.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "cid",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["processing_status"],
                properties: {
                  processing_status: {
                    type: "string",
                    enum: ["active", "paused"],
                    example: "paused"
                  },
                  reason: {
                    type: "string",
                    nullable: true,
                    example: "Gemini API key not set"
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Status changed" },
          400: { description: "Invalid processing_status" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      }
    },

    "/api/channels/{cid}/api-key": {
      put: {
        tags: ["Channels"],
        summary: "Set custom channel API key",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "cid",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["api_key"],
                properties: {
                  api_key: {
                    type: "string",
                    example: "custom_channel_key_123456"
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "API key updated" },
          400: { description: "Invalid api_key" },
          401: { description: "Unauthorized" },
          409: { description: "api_key already used" }
        }
      }
    },

    "/api/channels/{cid}/rotate-key": {
      post: {
        tags: ["Channels"],
        summary: "Rotate channel API key",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "cid",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        responses: {
          200: { description: "New API key generated" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" },
          409: { description: "api_key already used" }
        }
      }
    },

    "/api/channels/{id}/prompt": {
      get: {
        tags: ["Channel Prompts"],
        summary: "Get channel custom prompt",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        responses: {
          200: { description: "Custom prompt returned" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      },
      post: {
        tags: ["Channel Prompts"],
        summary: "Update channel custom prompt",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  custom_prompt: {
                    type: "string",
                    example: "Analyze delivery complaints more strictly."
                  },
                  accept_improved: {
                    type: "boolean",
                    example: false
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Prompt saved" },
          400: { description: "Prompt rejected or validation error" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      },
      delete: {
        tags: ["Channel Prompts"],
        summary: "Delete channel custom prompt",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        responses: {
          200: { description: "Prompt deleted" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      }
    },

    "/api/appeals": {
      post: {
        tags: ["Appeals"],
        summary: "Create appeal for analysis",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["cid", "text"],
                properties: {
                  cid: { type: "integer", example: 27 },
                  text: {
                    type: "string",
                    example: "The delivery was late and support did not answer."
                  }
                }
              }
            }
          }
        },
        responses: {
          202: { description: "Appeal queued for analysis" },
          400: { description: "cid or text is required" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/appeals/external": {
      post: {
        tags: ["Appeals"],
        summary: "Create external appeal by channel API key",
        security: [{ channelApiKey: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: {
                    type: "string",
                    example: "Your website payment page is not working."
                  }
                }
              }
            }
          }
        },
        responses: {
          202: { description: "External appeal queued" },
          400: { description: "text required" },
          401: { description: "Channel auth missing" }
        }
      }
    },

    "/api/appeals/history": {
      get: {
        tags: ["Appeals"],
        summary: "Get appeals history",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel_id", in: "query", schema: { type: "integer" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string" } },
          {
            name: "anomaly",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] }
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", example: 50 }
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", example: 0 }
          }
        ],
        responses: {
          200: { description: "Appeals history" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/appeals/map": {
      get: {
        tags: ["Appeals"],
        summary: "Get appeals map data",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Map data" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/appeals/search": {
      get: {
        tags: ["Appeals"],
        summary: "Search appeals",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "channel_id",
            in: "query",
            required: true,
            schema: { type: "integer" },
            example: 27
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            example: "delivery"
          },
          {
            name: "type",
            in: "query",
            schema: { type: "string" },
            example: "criticism"
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
            example: "new"
          }
        ],
        responses: {
          200: { description: "Search results" },
          400: { description: "channel_id is required" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" }
        }
      }
    },

    "/api/appeals/channel/{channelId}/all": {
      delete: {
        tags: ["Appeals"],
        summary: "Delete all appeals by channel",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "channelId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        responses: {
          200: { description: "All channel appeals deleted" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      }
    },

    "/api/appeals/{appealId}": {
      delete: {
        tags: ["Appeals"],
        summary: "Delete appeal by id",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "appealId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 101
          }
        ],
        responses: {
          200: { description: "Appeal deleted" },
          401: { description: "Unauthorized" },
          404: { description: "Appeal not found or access denied" }
        }
      }
    },

    "/api/assistant/session": {
      post: {
        tags: ["Assistant"],
        summary: "Start assistant session",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cid: { type: "integer", example: 27 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Assistant session created" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      }
    },

    "/api/assistant/chat": {
      post: {
        tags: ["Assistant"],
        summary: "Chat with assistant",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["session_token", "message"],
                properties: {
                  session_token: {
                    type: "string",
                    example: "assistant_session_token"
                  },
                  message: {
                    type: "string",
                    example: "Give me a summary of this channel."
                  },
                  cid: { type: "integer", nullable: true, example: 27 },
                  mode: {
                    type: "string",
                    example: "auto"
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Assistant response" },
          400: { description: "session_token and message are required" },
          401: { description: "Unauthorized" },
          404: { description: "Session not found or invalid" }
        }
      }
    },

    "/api/profile": {
      patch: {
        tags: ["Profile"],
        summary: "Update profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  full_name: { type: "string", example: "Ali K." },
                  email: { type: "string", example: "ali@mail.com" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Profile updated" },
          400: { description: "Provide full_name or email" },
          401: { description: "Unauthorized" },
          409: { description: "Email already in use" }
        }
      }
    },

    "/api/profile/password": {
      patch: {
        tags: ["Profile"],
        summary: "Change password",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["current_password", "new_password"],
                properties: {
                  current_password: { type: "string", example: "123456" },
                  new_password: { type: "string", example: "newpass123" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Password changed" },
          400: { description: "Validation error" },
          401: { description: "Wrong current_password" },
          404: { description: "User not found" }
        }
      }
    },

    "/api/reports/channels": {
      get: {
        tags: ["Reports"],
        summary: "Get user channels reports",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Channels reports" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/reports/stats": {
      get: {
        tags: ["Reports"],
        summary: "Get appeals stats",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel_id", in: "query", schema: { type: "integer" } },
          {
            name: "days",
            in: "query",
            schema: { type: "integer", example: 30 }
          }
        ],
        responses: {
          200: { description: "Appeals statistics" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/reports/summary": {
      get: {
        tags: ["Reports"],
        summary: "Get AI appeals summary",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "channel_id", in: "query", schema: { type: "integer" } },
          {
            name: "days",
            in: "query",
            schema: { type: "integer", example: 30 }
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", example: 50 }
          }
        ],
        responses: {
          200: { description: "AI summary" },
          400: { description: "Gemini API key not set" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/channels/{channelId}/resume": {
      post: {
        tags: ["Reports"],
        summary: "Resume channel processing",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "channelId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            example: 27
          }
        ],
        responses: {
          200: { description: "Channel processing resumed" },
          401: { description: "Unauthorized" },
          404: { description: "Channel not found or access denied" }
        }
      }
    },

    "/api/search": {
      get: {
        tags: ["Search"],
        summary: "Search appeals by Elasticsearch",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "channel_id",
            in: "query",
            required: true,
            schema: { type: "integer" },
            example: 27
          },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } }
        ],
        responses: {
          200: { description: "Search results" },
          400: { description: "channel_id is required" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" }
        }
      }
    },

    "/api/me/gemini-key": {
      patch: {
        tags: ["User Keys"],
        summary: "Save Gemini API key",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["gemini_api_key"],
                properties: {
                  gemini_api_key: {
                    type: "string",
                    example: "AIza..."
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Gemini key saved" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" }
        }
      },
      delete: {
        tags: ["User Keys"],
        summary: "Delete Gemini API key",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Gemini key deleted" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/context": {
      post: {
        tags: ["AI"],
        summary: "Generate text by context",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: {
                    type: "string",
                    example: "Explain this user complaint."
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Generated response" },
          400: { description: "text required or Gemini key not set" },
          401: { description: "Unauthorized" }
        }
      }
    },

    "/api/langrussian": {
      post: {
        tags: ["AI"],
        summary: "Translate text to Russian",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: {
                    type: "string",
                    example: "Hello, I need help with delivery."
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Translated response" },
          400: { description: "text required or Gemini key not set" },
          401: { description: "Unauthorized" }
        }
      }
    }
  }
};