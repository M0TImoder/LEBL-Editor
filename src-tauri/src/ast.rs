use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstNode {
    pub node_type: String,
    pub value: Option<String>,
    pub children: Vec<AstNode>,
}

impl AstNode {
    pub fn empty_program() -> Self {
        Self {
            node_type: "program".to_string(),
            value: None,
            children: Vec::new(),
        }
    }

    pub fn from_python(source: String) -> Self {
        let lines = if source.is_empty() {
            Vec::new()
        } else {
            source
                .split('\n')
                .map(|line| AstNode {
                    node_type: "line".to_string(),
                    value: Some(line.to_string()),
                    children: Vec::new(),
                })
                .collect()
        };
        Self {
            node_type: "program".to_string(),
            value: None,
            children: lines,
        }
    }

    pub fn to_python(&self) -> String {
        if self.node_type != "program" {
            return self.value.clone().unwrap_or_default();
        }
        let mut lines = Vec::new();
        for child in &self.children {
            if child.node_type == "line" {
                lines.push(child.value.clone().unwrap_or_default());
            } else {
                lines.push(child.to_python());
            }
        }
        lines.join("\n")
    }
}
