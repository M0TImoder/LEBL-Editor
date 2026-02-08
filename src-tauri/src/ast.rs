use serde::{Deserialize, Serialize};
use std::fmt;
use std::iter::Peekable;
use std::str::Chars;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Position {
    pub line: usize,
    pub column: usize,
    pub offset: usize,
}

impl Default for Position {
    fn default() -> Self {
        Self {
            line: 1,
            column: 1,
            offset: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Span {
    pub start: Position,
    pub end: Position,
}

impl Default for Span {
    fn default() -> Self {
        Self {
            start: Position::default(),
            end: Position::default(),
        }
    }
}

impl Span {
    fn join(start: Position, end: Position) -> Self {
        Self { start, end }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct TokenRange {
    pub start: usize,
    pub end: usize,
}

impl Default for TokenRange {
    fn default() -> Self {
        Self { start: 0, end: 0 }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct NodeId(pub u64);

impl Default for NodeId {
    fn default() -> Self {
        Self(0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NodeMeta {
    #[serde(default)]
    pub id: NodeId,
    #[serde(default)]
    pub span: Span,
    #[serde(default)]
    pub token_range: TokenRange,
    #[serde(default)]
    pub leading_trivia: Vec<Trivia>,
    #[serde(default)]
    pub trailing_trivia: Vec<Trivia>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Trivia {
    pub kind: TriviaKind,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "data")]
pub enum TriviaKind {
    Comment(String),
    RawWhitespace(String),
    Blank(BlankSource),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BlankSource {
    Source,
    Generated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Program {
    #[serde(default)]
    pub meta: NodeMeta,
    pub indent_width: usize,
    pub body: Vec<Stmt>,
    #[serde(default)]
    /// Parsed tokens with attached trivia for pretty rendering.
    pub tokens: Vec<Token>,
    #[serde(default)]
    /// Raw lexer tokens preserved for lossless rendering.
    pub raw_tokens: Vec<LexToken>,
    #[serde(default)]
    pub dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum Stmt {
    If(IfStmt),
    While(WhileStmt),
    For(ForStmt),
    Match(MatchStmt),
    Assign(AssignStmt),
    Expr(ExprStmt),
    Pass(PassStmt),
    Empty(EmptyStmt),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub condition: Expr,
    pub body: Block,
    pub elifs: Vec<ElifStmt>,
    pub else_body: Option<Block>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElifStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub condition: Expr,
    pub body: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhileStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub condition: Expr,
    pub body: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: Expr,
    pub iterable: Expr,
    pub body: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub subject: Expr,
    pub cases: CaseBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseBlock {
    #[serde(default)]
    pub meta: NodeMeta,
    pub indent_level: usize,
    pub cases: Vec<MatchCase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchCase {
    #[serde(default)]
    pub meta: NodeMeta,
    pub pattern: Pattern,
    pub body: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: Expr,
    pub value: Expr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExprStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub expr: Expr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PassStmt {
    #[serde(default)]
    pub meta: NodeMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmptyStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub source: BlankSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    #[serde(default)]
    pub meta: NodeMeta,
    pub indent_level: usize,
    pub statements: Vec<Stmt>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum Expr {
    Identifier(IdentifierExpr),
    Literal(LiteralExpr),
    Binary(BinaryExpr),
    Unary(UnaryExpr),
    BoolOp(BoolOpExpr),
    Compare(CompareExpr),
    Lambda(LambdaExpr),
    IfExpr(IfExpr),
    Call(CallExpr),
    Tuple(TupleExpr),
    Attribute(AttributeExpr),
    Subscript(SubscriptExpr),
    Grouped(GroupedExpr),
    List(ListExpr),
    Dict(DictExpr),
    Set(SetExpr),
    Comprehension(ComprehensionExpr),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentifierExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiteralExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub literal: Literal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub left: Box<Expr>,
    pub op: BinaryOp,
    pub right: Box<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnaryExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub op: UnaryOp,
    pub expr: Box<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoolOpExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub op: BoolOp,
    pub values: Vec<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub left: Box<Expr>,
    pub ops: Vec<CompareOp>,
    pub comparators: Vec<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LambdaExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub params: Vec<String>,
    pub body: Box<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IfExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub body: Box<Expr>,
    pub condition: Box<Expr>,
    pub else_body: Box<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub callee: Box<Expr>,
    pub args: Vec<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TupleExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub elements: Vec<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttributeExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub value: Box<Expr>,
    pub attr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub value: Box<Expr>,
    pub index: Box<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupedExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub expr: Box<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub elements: Vec<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub entries: Vec<DictEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub elements: Vec<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictEntry {
    #[serde(default)]
    pub meta: NodeMeta,
    pub key: Expr,
    pub value: Expr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
pub enum ComprehensionExpr {
    List(ComprehensionListExpr),
    Set(ComprehensionSetExpr),
    Generator(ComprehensionGeneratorExpr),
    Dict(ComprehensionDictExpr),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComprehensionListExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub element: Box<Expr>,
    pub fors: Vec<ComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComprehensionSetExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub element: Box<Expr>,
    pub fors: Vec<ComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComprehensionGeneratorExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub element: Box<Expr>,
    pub fors: Vec<ComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComprehensionDictExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub key: Box<Expr>,
    pub value: Box<Expr>,
    pub fors: Vec<ComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComprehensionFor {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: Expr,
    pub iter: Expr,
    pub ifs: Vec<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BinaryOp {
    Add,
    Sub,
    Mul,
    Div,
    Mod,
}

impl BinaryOp {
    fn precedence(&self) -> u8 {
        match self {
            BinaryOp::Add | BinaryOp::Sub => 5,
            BinaryOp::Mul | BinaryOp::Div | BinaryOp::Mod => 6,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UnaryOp {
    Neg,
    Not,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BoolOp {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CompareOp {
    Eq,
    NotEq,
    Lt,
    LtEq,
    Gt,
    GtEq,
    In,
    NotIn,
    Is,
    IsNot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum Literal {
    Number(NumberLiteral),
    String(StringLiteral),
    Bool(bool),
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NumberLiteral {
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StringLiteral {
    pub raw: String,
    pub value: String,
    pub quote: QuoteStyle,
    pub escaped: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum QuoteStyle {
    Single,
    Double,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum Pattern {
    Wildcard(NodeMeta),
    Identifier(PatternIdentifier),
    Literal(PatternLiteral),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternIdentifier {
    #[serde(default)]
    pub meta: NodeMeta,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternLiteral {
    #[serde(default)]
    pub meta: NodeMeta,
    pub literal: Literal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrProgram {
    #[serde(default)]
    pub meta: NodeMeta,
    pub indent_width: usize,
    pub body: Vec<IrStmt>,
    #[serde(default)]
    pub token_store: Option<TokenStore>,
    #[serde(default)]
    pub dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum IrStmt {
    If(IrIfStmt),
    While(IrWhileStmt),
    For(IrForStmt),
    Match(IrMatchStmt),
    Assign(IrAssignStmt),
    Expr(IrExprStmt),
    Pass(IrPassStmt),
    Empty(IrEmptyStmt),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrIfStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub condition: IrExpr,
    pub body: IrBlock,
    pub elifs: Vec<IrElifStmt>,
    pub else_body: Option<IrBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrElifStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub condition: IrExpr,
    pub body: IrBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrWhileStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub condition: IrExpr,
    pub body: IrBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrForStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: IrExpr,
    pub iterable: IrExpr,
    pub body: IrBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrMatchStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub subject: IrExpr,
    pub cases: IrCaseBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrCaseBlock {
    #[serde(default)]
    pub meta: NodeMeta,
    pub indent_level: usize,
    pub cases: Vec<IrMatchCase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrMatchCase {
    #[serde(default)]
    pub meta: NodeMeta,
    pub pattern: IrPattern,
    pub body: IrBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrAssignStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: IrExpr,
    pub value: IrExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrExprStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub expr: IrExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrPassStmt {
    #[serde(default)]
    pub meta: NodeMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrEmptyStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub source: BlankSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrBlock {
    #[serde(default)]
    pub meta: NodeMeta,
    pub indent_level: usize,
    pub statements: Vec<IrStmt>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum IrExpr {
    Identifier(IrIdentifierExpr),
    Literal(IrLiteralExpr),
    Binary(IrBinaryExpr),
    Unary(IrUnaryExpr),
    BoolOp(IrBoolOpExpr),
    Compare(IrCompareExpr),
    Lambda(IrLambdaExpr),
    IfExpr(IrIfExpr),
    Call(IrCallExpr),
    Tuple(IrTupleExpr),
    Attribute(IrAttributeExpr),
    Subscript(IrSubscriptExpr),
    Grouped(IrGroupedExpr),
    List(IrListExpr),
    Dict(IrDictExpr),
    Set(IrSetExpr),
    Comprehension(IrComprehensionExpr),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrIdentifierExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrLiteralExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub literal: Literal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrBinaryExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub left: Box<IrExpr>,
    pub op: BinaryOp,
    pub right: Box<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrUnaryExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub op: UnaryOp,
    pub expr: Box<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrBoolOpExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub op: BoolOp,
    pub values: Vec<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrCompareExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub left: Box<IrExpr>,
    pub ops: Vec<CompareOp>,
    pub comparators: Vec<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrLambdaExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub params: Vec<String>,
    pub body: Box<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrIfExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub body: Box<IrExpr>,
    pub condition: Box<IrExpr>,
    pub else_body: Box<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrCallExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub callee: Box<IrExpr>,
    pub args: Vec<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrTupleExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub elements: Vec<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrAttributeExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub value: Box<IrExpr>,
    pub attr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrSubscriptExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub value: Box<IrExpr>,
    pub index: Box<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrGroupedExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub expr: Box<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrListExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub elements: Vec<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrDictExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub entries: Vec<IrDictEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrSetExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub elements: Vec<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrDictEntry {
    #[serde(default)]
    pub meta: NodeMeta,
    pub key: IrExpr,
    pub value: IrExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
pub enum IrComprehensionExpr {
    List(IrComprehensionListExpr),
    Set(IrComprehensionSetExpr),
    Generator(IrComprehensionGeneratorExpr),
    Dict(IrComprehensionDictExpr),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrComprehensionListExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub element: Box<IrExpr>,
    pub fors: Vec<IrComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrComprehensionSetExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub element: Box<IrExpr>,
    pub fors: Vec<IrComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrComprehensionGeneratorExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub element: Box<IrExpr>,
    pub fors: Vec<IrComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrComprehensionDictExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub key: Box<IrExpr>,
    pub value: Box<IrExpr>,
    pub fors: Vec<IrComprehensionFor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrComprehensionFor {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: IrExpr,
    pub iter: IrExpr,
    pub ifs: Vec<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum IrPattern {
    Wildcard(NodeMeta),
    Identifier(PatternIdentifier),
    Literal(PatternLiteral),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenStore {
    pub raw_tokens: Vec<LexToken>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LexToken {
    pub kind: TokenKind,
    pub span: Span,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub kind: TokenKind,
    pub span: Span,
    pub raw: String,
    pub leading_trivia: Vec<Trivia>,
    pub trailing_trivia: Vec<Trivia>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", content = "data")]
pub enum TokenKind {
    Identifier(String),
    Number(NumberLiteral),
    String(StringLiteral),
    Keyword(Keyword),
    Operator(Operator),
    LParen,
    RParen,
    LBracket,
    RBracket,
    LBrace,
    RBrace,
    Dot,
    Colon,
    Comma,
    Newline,
    Indent { level: usize },
    Dedent { level: usize },
    Comment(String),
    RawWhitespace(String),
    Blank(BlankSource),
    Eof,
    Indentation(usize),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Keyword {
    If,
    Elif,
    Else,
    While,
    For,
    In,
    Is,
    Lambda,
    Match,
    Case,
    Pass,
    And,
    Or,
    Not,
    True,
    False,
    None,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Operator {
    Assign,
    Eq,
    NotEq,
    Lt,
    LtEq,
    Gt,
    GtEq,
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PythonVersion {
    Py39,
    Py310,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct FeatureSet {
    pub match_stmt: bool,
}

impl FeatureSet {
    pub fn from_version(version: PythonVersion) -> Self {
        match version {
            PythonVersion::Py39 => Self { match_stmt: false },
            PythonVersion::Py310 => Self { match_stmt: true },
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct ParserConfig {
    pub features: FeatureSet,
}

impl Default for ParserConfig {
    fn default() -> Self {
        Self {
            features: FeatureSet::from_version(PythonVersion::Py310),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RenderMode {
    Lossless,
    Pretty,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenderConfig {
    pub mode: RenderMode,
    pub reuse_token_ranges: bool,
}

impl Default for RenderConfig {
    fn default() -> Self {
        Self {
            mode: RenderMode::Lossless,
            reuse_token_ranges: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Associativity {
    Left,
    Right,
}

#[derive(Debug, Clone)]
struct BinaryOpInfo {
    op: BinaryOp,
    precedence: u8,
    assoc: Associativity,
}

#[derive(Debug, Clone)]
pub struct ParseError {
    pub message: String,
    pub span: Span,
}

impl fmt::Display for ParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "line {}:{} {}",
            self.span.start.line, self.span.start.column, self.message
        )
    }
}

impl std::error::Error for ParseError {}

#[derive(Debug, Clone)]
pub struct ConvertError {
    pub message: String,
}

impl fmt::Display for ConvertError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for ConvertError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TokenTag {
    Identifier,
    Number,
    String,
    Keyword,
    Operator,
    LParen,
    RParen,
    LBracket,
    RBracket,
    LBrace,
    RBrace,
    Dot,
    Colon,
    Comma,
    Newline,
    Indent,
    Dedent,
    Eof,
}

impl TokenKind {
    fn tag(&self) -> TokenTag {
        match self {
            TokenKind::Identifier(_) => TokenTag::Identifier,
            TokenKind::Number(_) => TokenTag::Number,
            TokenKind::String(_) => TokenTag::String,
            TokenKind::Keyword(_) => TokenTag::Keyword,
            TokenKind::Operator(_) => TokenTag::Operator,
            TokenKind::LParen => TokenTag::LParen,
            TokenKind::RParen => TokenTag::RParen,
            TokenKind::LBracket => TokenTag::LBracket,
            TokenKind::RBracket => TokenTag::RBracket,
            TokenKind::LBrace => TokenTag::LBrace,
            TokenKind::RBrace => TokenTag::RBrace,
            TokenKind::Dot => TokenTag::Dot,
            TokenKind::Colon => TokenTag::Colon,
            TokenKind::Comma => TokenTag::Comma,
            TokenKind::Newline => TokenTag::Newline,
            TokenKind::Indent { .. } => TokenTag::Indent,
            TokenKind::Dedent { .. } => TokenTag::Dedent,
            TokenKind::Eof => TokenTag::Eof,
            TokenKind::Comment(_)
            | TokenKind::RawWhitespace(_)
            | TokenKind::Blank(_)
            | TokenKind::Indentation(_) => TokenTag::Eof,
        }
    }

    fn is_trivia(&self) -> bool {
        matches!(
            self,
            TokenKind::Comment(_)
                | TokenKind::RawWhitespace(_)
                | TokenKind::Blank(_)
                | TokenKind::Indentation(_)
        )
    }
}

impl Program {
    pub fn empty(indent_width: usize) -> Self {
        Self {
            meta: NodeMeta::default(),
            indent_width,
            body: Vec::new(),
            tokens: Vec::new(),
            raw_tokens: Vec::new(),
            dirty: false,
        }
    }

    pub fn parse(source: String, config: ParserConfig) -> Result<Self, ParseError> {
        let mut lexer = Lexer::new(source);
        let lexed = lexer.lex()?;
        let raw_tokens = lexed.tokens.clone();
        let tokens = attach_trivia(insert_indent_tokens(lexed.tokens));
        let mut parser = Parser::new(tokens.clone(), config, lexed.indent_width);
        let mut program = parser.parse_program()?;
        program.tokens = tokens;
        program.raw_tokens = raw_tokens;
        Ok(program)
    }

    pub fn to_python(&self, config: RenderConfig) -> String {
        if config.mode == RenderMode::Lossless && !self.dirty && !self.raw_tokens.is_empty() {
            return render_lossless(&self.raw_tokens);
        }
        render_pretty(self, config)
    }
}

pub fn python_to_ir(program: &Program) -> IrProgram {
    IrProgram {
        meta: program.meta.clone(),
        indent_width: program.indent_width,
        body: program.body.iter().map(stmt_to_ir).collect(),
        token_store: if program.raw_tokens.is_empty() {
            None
        } else {
            Some(TokenStore {
                raw_tokens: program.raw_tokens.clone(),
            })
        },
        dirty: program.dirty,
    }
}

pub fn ir_to_python(ir: &IrProgram, features: &FeatureSet) -> Result<Program, ConvertError> {
    if !features.match_stmt {
        if ir.body.iter().any(ir_contains_match) {
            return Err(ConvertError {
                message: "match is disabled".to_string(),
            });
        }
    }
    let mut program = Program::empty(ir.indent_width);
    program.meta = ir.meta.clone();
    program.body = ir
        .body
        .iter()
        .map(|stmt| stmt_from_ir_with_indent(stmt, 0))
        .collect();
    program.raw_tokens = ir
        .token_store
        .as_ref()
        .map(|store| store.raw_tokens.clone())
        .unwrap_or_default();
    program.dirty = ir.dirty || program.raw_tokens.is_empty();
    Ok(program)
}

fn ir_contains_match(stmt: &IrStmt) -> bool {
    match stmt {
        IrStmt::Match(_) => true,
        IrStmt::If(stmt) => {
            block_has_match(&stmt.body)
                || stmt.elifs.iter().any(|elif| block_has_match(&elif.body))
                || stmt
                    .else_body
                    .as_ref()
                    .map(block_has_match)
                    .unwrap_or(false)
        }
        IrStmt::While(stmt) => block_has_match(&stmt.body),
        IrStmt::For(stmt) => block_has_match(&stmt.body),
        IrStmt::Assign(_) | IrStmt::Expr(_) | IrStmt::Pass(_) | IrStmt::Empty(_) => false,
    }
}

fn block_has_match(block: &IrBlock) -> bool {
    block.statements.iter().any(ir_contains_match)
}

fn stmt_to_ir(stmt: &Stmt) -> IrStmt {
    match stmt {
        Stmt::If(stmt) => IrStmt::If(IrIfStmt {
            meta: stmt.meta.clone(),
            condition: expr_to_ir(&stmt.condition),
            body: block_to_ir(&stmt.body),
            elifs: stmt
                .elifs
                .iter()
                .map(|elif| IrElifStmt {
                    meta: elif.meta.clone(),
                    condition: expr_to_ir(&elif.condition),
                    body: block_to_ir(&elif.body),
                })
                .collect(),
            else_body: stmt.else_body.as_ref().map(block_to_ir),
        }),
        Stmt::While(stmt) => IrStmt::While(IrWhileStmt {
            meta: stmt.meta.clone(),
            condition: expr_to_ir(&stmt.condition),
            body: block_to_ir(&stmt.body),
        }),
        Stmt::For(stmt) => IrStmt::For(IrForStmt {
            meta: stmt.meta.clone(),
            target: expr_to_ir(&stmt.target),
            iterable: expr_to_ir(&stmt.iterable),
            body: block_to_ir(&stmt.body),
        }),
        Stmt::Match(stmt) => IrStmt::Match(IrMatchStmt {
            meta: stmt.meta.clone(),
            subject: expr_to_ir(&stmt.subject),
            cases: IrCaseBlock {
                meta: stmt.cases.meta.clone(),
                indent_level: stmt.cases.indent_level,
                cases: stmt
                    .cases
                    .cases
                    .iter()
                    .map(|case_stmt| IrMatchCase {
                        meta: case_stmt.meta.clone(),
                        pattern: pattern_to_ir(&case_stmt.pattern),
                        body: block_to_ir(&case_stmt.body),
                    })
                    .collect(),
            },
        }),
        Stmt::Assign(stmt) => IrStmt::Assign(IrAssignStmt {
            meta: stmt.meta.clone(),
            target: expr_to_ir(&stmt.target),
            value: expr_to_ir(&stmt.value),
        }),
        Stmt::Expr(stmt) => IrStmt::Expr(IrExprStmt {
            meta: stmt.meta.clone(),
            expr: expr_to_ir(&stmt.expr),
        }),
        Stmt::Pass(stmt) => IrStmt::Pass(IrPassStmt {
            meta: stmt.meta.clone(),
        }),
        Stmt::Empty(stmt) => IrStmt::Empty(IrEmptyStmt {
            meta: stmt.meta.clone(),
            source: stmt.source.clone(),
        }),
    }
}

fn stmt_from_ir_with_indent(stmt: &IrStmt, indent_level: usize) -> Stmt {
    match stmt {
        IrStmt::If(stmt) => Stmt::If(IfStmt {
            meta: stmt.meta.clone(),
            condition: expr_from_ir(&stmt.condition),
            body: block_from_ir_with_indent(&stmt.body, indent_level + 1),
            elifs: stmt
                .elifs
                .iter()
                .map(|elif| ElifStmt {
                    meta: elif.meta.clone(),
                    condition: expr_from_ir(&elif.condition),
                    body: block_from_ir_with_indent(&elif.body, indent_level + 1),
                })
                .collect(),
            else_body: stmt
                .else_body
                .as_ref()
                .map(|block| block_from_ir_with_indent(block, indent_level + 1)),
        }),
        IrStmt::While(stmt) => Stmt::While(WhileStmt {
            meta: stmt.meta.clone(),
            condition: expr_from_ir(&stmt.condition),
            body: block_from_ir_with_indent(&stmt.body, indent_level + 1),
        }),
        IrStmt::For(stmt) => Stmt::For(ForStmt {
            meta: stmt.meta.clone(),
            target: expr_from_ir(&stmt.target),
            iterable: expr_from_ir(&stmt.iterable),
            body: block_from_ir_with_indent(&stmt.body, indent_level + 1),
        }),
        IrStmt::Match(stmt) => Stmt::Match(MatchStmt {
            meta: stmt.meta.clone(),
            subject: expr_from_ir(&stmt.subject),
            cases: CaseBlock {
                meta: stmt.cases.meta.clone(),
                indent_level: indent_level + 1,
                cases: stmt
                    .cases
                    .cases
                    .iter()
                    .map(|case_stmt| MatchCase {
                        meta: case_stmt.meta.clone(),
                        pattern: pattern_from_ir(&case_stmt.pattern),
                        body: block_from_ir_with_indent(
                            &case_stmt.body,
                            indent_level + 2,
                        ),
                    })
                    .collect(),
            },
        }),
        IrStmt::Assign(stmt) => Stmt::Assign(AssignStmt {
            meta: stmt.meta.clone(),
            target: expr_from_ir(&stmt.target),
            value: expr_from_ir(&stmt.value),
        }),
        IrStmt::Expr(stmt) => Stmt::Expr(ExprStmt {
            meta: stmt.meta.clone(),
            expr: expr_from_ir(&stmt.expr),
        }),
        IrStmt::Pass(stmt) => Stmt::Pass(PassStmt {
            meta: stmt.meta.clone(),
        }),
        IrStmt::Empty(stmt) => Stmt::Empty(EmptyStmt {
            meta: stmt.meta.clone(),
            source: stmt.source.clone(),
        }),
    }
}

fn block_to_ir(block: &Block) -> IrBlock {
    IrBlock {
        meta: block.meta.clone(),
        indent_level: block.indent_level,
        statements: block.statements.iter().map(stmt_to_ir).collect(),
    }
}

fn block_from_ir_with_indent(block: &IrBlock, indent_level: usize) -> Block {
    Block {
        meta: block.meta.clone(),
        indent_level,
        statements: block
            .statements
            .iter()
            .map(|stmt| stmt_from_ir_with_indent(stmt, indent_level))
            .collect(),
    }
}

fn expr_to_ir(expr: &Expr) -> IrExpr {
    match expr {
        Expr::Identifier(expr) => IrExpr::Identifier(IrIdentifierExpr {
            meta: expr.meta.clone(),
            name: expr.name.clone(),
        }),
        Expr::Literal(expr) => IrExpr::Literal(IrLiteralExpr {
            meta: expr.meta.clone(),
            literal: expr.literal.clone(),
        }),
        Expr::Binary(expr) => IrExpr::Binary(IrBinaryExpr {
            meta: expr.meta.clone(),
            left: Box::new(expr_to_ir(&expr.left)),
            op: expr.op.clone(),
            right: Box::new(expr_to_ir(&expr.right)),
        }),
        Expr::Unary(expr) => IrExpr::Unary(IrUnaryExpr {
            meta: expr.meta.clone(),
            op: expr.op.clone(),
            expr: Box::new(expr_to_ir(&expr.expr)),
        }),
        Expr::BoolOp(expr) => IrExpr::BoolOp(IrBoolOpExpr {
            meta: expr.meta.clone(),
            op: expr.op.clone(),
            values: expr.values.iter().map(expr_to_ir).collect(),
        }),
        Expr::Compare(expr) => IrExpr::Compare(IrCompareExpr {
            meta: expr.meta.clone(),
            left: Box::new(expr_to_ir(&expr.left)),
            ops: expr.ops.clone(),
            comparators: expr.comparators.iter().map(expr_to_ir).collect(),
        }),
        Expr::Lambda(expr) => IrExpr::Lambda(IrLambdaExpr {
            meta: expr.meta.clone(),
            params: expr.params.clone(),
            body: Box::new(expr_to_ir(&expr.body)),
        }),
        Expr::IfExpr(expr) => IrExpr::IfExpr(IrIfExpr {
            meta: expr.meta.clone(),
            body: Box::new(expr_to_ir(&expr.body)),
            condition: Box::new(expr_to_ir(&expr.condition)),
            else_body: Box::new(expr_to_ir(&expr.else_body)),
        }),
        Expr::Call(expr) => IrExpr::Call(IrCallExpr {
            meta: expr.meta.clone(),
            callee: Box::new(expr_to_ir(&expr.callee)),
            args: expr.args.iter().map(expr_to_ir).collect(),
        }),
        Expr::Tuple(expr) => IrExpr::Tuple(IrTupleExpr {
            meta: expr.meta.clone(),
            elements: expr.elements.iter().map(expr_to_ir).collect(),
        }),
        Expr::Attribute(expr) => IrExpr::Attribute(IrAttributeExpr {
            meta: expr.meta.clone(),
            value: Box::new(expr_to_ir(&expr.value)),
            attr: expr.attr.clone(),
        }),
        Expr::Subscript(expr) => IrExpr::Subscript(IrSubscriptExpr {
            meta: expr.meta.clone(),
            value: Box::new(expr_to_ir(&expr.value)),
            index: Box::new(expr_to_ir(&expr.index)),
        }),
        Expr::Grouped(expr) => IrExpr::Grouped(IrGroupedExpr {
            meta: expr.meta.clone(),
            expr: Box::new(expr_to_ir(&expr.expr)),
        }),
        Expr::List(expr) => IrExpr::List(IrListExpr {
            meta: expr.meta.clone(),
            elements: expr.elements.iter().map(expr_to_ir).collect(),
        }),
        Expr::Dict(expr) => IrExpr::Dict(IrDictExpr {
            meta: expr.meta.clone(),
            entries: expr
                .entries
                .iter()
                .map(|entry| IrDictEntry {
                    meta: entry.meta.clone(),
                    key: expr_to_ir(&entry.key),
                    value: expr_to_ir(&entry.value),
                })
                .collect(),
        }),
        Expr::Set(expr) => IrExpr::Set(IrSetExpr {
            meta: expr.meta.clone(),
            elements: expr.elements.iter().map(expr_to_ir).collect(),
        }),
        Expr::Comprehension(expr) => IrExpr::Comprehension(match expr {
            ComprehensionExpr::List(expr) => {
                IrComprehensionExpr::List(IrComprehensionListExpr {
                    meta: expr.meta.clone(),
                    element: Box::new(expr_to_ir(&expr.element)),
                    fors: expr
                        .fors
                        .iter()
                        .map(|comp| IrComprehensionFor {
                            meta: comp.meta.clone(),
                            target: expr_to_ir(&comp.target),
                            iter: expr_to_ir(&comp.iter),
                            ifs: comp.ifs.iter().map(expr_to_ir).collect(),
                        })
                        .collect(),
                })
            }
            ComprehensionExpr::Set(expr) => {
                IrComprehensionExpr::Set(IrComprehensionSetExpr {
                    meta: expr.meta.clone(),
                    element: Box::new(expr_to_ir(&expr.element)),
                    fors: expr
                        .fors
                        .iter()
                        .map(|comp| IrComprehensionFor {
                            meta: comp.meta.clone(),
                            target: expr_to_ir(&comp.target),
                            iter: expr_to_ir(&comp.iter),
                            ifs: comp.ifs.iter().map(expr_to_ir).collect(),
                        })
                        .collect(),
                })
            }
            ComprehensionExpr::Generator(expr) => {
                IrComprehensionExpr::Generator(IrComprehensionGeneratorExpr {
                    meta: expr.meta.clone(),
                    element: Box::new(expr_to_ir(&expr.element)),
                    fors: expr
                        .fors
                        .iter()
                        .map(|comp| IrComprehensionFor {
                            meta: comp.meta.clone(),
                            target: expr_to_ir(&comp.target),
                            iter: expr_to_ir(&comp.iter),
                            ifs: comp.ifs.iter().map(expr_to_ir).collect(),
                        })
                        .collect(),
                })
            }
            ComprehensionExpr::Dict(expr) => {
                IrComprehensionExpr::Dict(IrComprehensionDictExpr {
                    meta: expr.meta.clone(),
                    key: Box::new(expr_to_ir(&expr.key)),
                    value: Box::new(expr_to_ir(&expr.value)),
                    fors: expr
                        .fors
                        .iter()
                        .map(|comp| IrComprehensionFor {
                            meta: comp.meta.clone(),
                            target: expr_to_ir(&comp.target),
                            iter: expr_to_ir(&comp.iter),
                            ifs: comp.ifs.iter().map(expr_to_ir).collect(),
                        })
                        .collect(),
                })
            }
        }),
    }
}

fn expr_from_ir(expr: &IrExpr) -> Expr {
    match expr {
        IrExpr::Identifier(expr) => Expr::Identifier(IdentifierExpr {
            meta: expr.meta.clone(),
            name: expr.name.clone(),
        }),
        IrExpr::Literal(expr) => Expr::Literal(LiteralExpr {
            meta: expr.meta.clone(),
            literal: expr.literal.clone(),
        }),
        IrExpr::Binary(expr) => Expr::Binary(BinaryExpr {
            meta: expr.meta.clone(),
            left: Box::new(expr_from_ir(&expr.left)),
            op: expr.op.clone(),
            right: Box::new(expr_from_ir(&expr.right)),
        }),
        IrExpr::Unary(expr) => Expr::Unary(UnaryExpr {
            meta: expr.meta.clone(),
            op: expr.op.clone(),
            expr: Box::new(expr_from_ir(&expr.expr)),
        }),
        IrExpr::BoolOp(expr) => Expr::BoolOp(BoolOpExpr {
            meta: expr.meta.clone(),
            op: expr.op.clone(),
            values: expr.values.iter().map(expr_from_ir).collect(),
        }),
        IrExpr::Compare(expr) => Expr::Compare(CompareExpr {
            meta: expr.meta.clone(),
            left: Box::new(expr_from_ir(&expr.left)),
            ops: expr.ops.clone(),
            comparators: expr.comparators.iter().map(expr_from_ir).collect(),
        }),
        IrExpr::Lambda(expr) => Expr::Lambda(LambdaExpr {
            meta: expr.meta.clone(),
            params: expr.params.clone(),
            body: Box::new(expr_from_ir(&expr.body)),
        }),
        IrExpr::IfExpr(expr) => Expr::IfExpr(IfExpr {
            meta: expr.meta.clone(),
            body: Box::new(expr_from_ir(&expr.body)),
            condition: Box::new(expr_from_ir(&expr.condition)),
            else_body: Box::new(expr_from_ir(&expr.else_body)),
        }),
        IrExpr::Call(expr) => Expr::Call(CallExpr {
            meta: expr.meta.clone(),
            callee: Box::new(expr_from_ir(&expr.callee)),
            args: expr.args.iter().map(expr_from_ir).collect(),
        }),
        IrExpr::Tuple(expr) => Expr::Tuple(TupleExpr {
            meta: expr.meta.clone(),
            elements: expr.elements.iter().map(expr_from_ir).collect(),
        }),
        IrExpr::Attribute(expr) => Expr::Attribute(AttributeExpr {
            meta: expr.meta.clone(),
            value: Box::new(expr_from_ir(&expr.value)),
            attr: expr.attr.clone(),
        }),
        IrExpr::Subscript(expr) => Expr::Subscript(SubscriptExpr {
            meta: expr.meta.clone(),
            value: Box::new(expr_from_ir(&expr.value)),
            index: Box::new(expr_from_ir(&expr.index)),
        }),
        IrExpr::Grouped(expr) => Expr::Grouped(GroupedExpr {
            meta: expr.meta.clone(),
            expr: Box::new(expr_from_ir(&expr.expr)),
        }),
        IrExpr::List(expr) => Expr::List(ListExpr {
            meta: expr.meta.clone(),
            elements: expr.elements.iter().map(expr_from_ir).collect(),
        }),
        IrExpr::Dict(expr) => Expr::Dict(DictExpr {
            meta: expr.meta.clone(),
            entries: expr
                .entries
                .iter()
                .map(|entry| DictEntry {
                    meta: entry.meta.clone(),
                    key: expr_from_ir(&entry.key),
                    value: expr_from_ir(&entry.value),
                })
                .collect(),
        }),
        IrExpr::Set(expr) => Expr::Set(SetExpr {
            meta: expr.meta.clone(),
            elements: expr.elements.iter().map(expr_from_ir).collect(),
        }),
        IrExpr::Comprehension(expr) => Expr::Comprehension(match expr {
            IrComprehensionExpr::List(expr) => {
                ComprehensionExpr::List(ComprehensionListExpr {
                    meta: expr.meta.clone(),
                    element: Box::new(expr_from_ir(&expr.element)),
                    fors: expr
                        .fors
                        .iter()
                        .map(|comp| ComprehensionFor {
                            meta: comp.meta.clone(),
                            target: expr_from_ir(&comp.target),
                            iter: expr_from_ir(&comp.iter),
                            ifs: comp.ifs.iter().map(expr_from_ir).collect(),
                        })
                        .collect(),
                })
            }
            IrComprehensionExpr::Set(expr) => ComprehensionExpr::Set(ComprehensionSetExpr {
                meta: expr.meta.clone(),
                element: Box::new(expr_from_ir(&expr.element)),
                fors: expr
                    .fors
                    .iter()
                    .map(|comp| ComprehensionFor {
                        meta: comp.meta.clone(),
                        target: expr_from_ir(&comp.target),
                        iter: expr_from_ir(&comp.iter),
                        ifs: comp.ifs.iter().map(expr_from_ir).collect(),
                    })
                    .collect(),
            }),
            IrComprehensionExpr::Generator(expr) => {
                ComprehensionExpr::Generator(ComprehensionGeneratorExpr {
                    meta: expr.meta.clone(),
                    element: Box::new(expr_from_ir(&expr.element)),
                    fors: expr
                        .fors
                        .iter()
                        .map(|comp| ComprehensionFor {
                            meta: comp.meta.clone(),
                            target: expr_from_ir(&comp.target),
                            iter: expr_from_ir(&comp.iter),
                            ifs: comp.ifs.iter().map(expr_from_ir).collect(),
                        })
                        .collect(),
                })
            }
            IrComprehensionExpr::Dict(expr) => ComprehensionExpr::Dict(ComprehensionDictExpr {
                meta: expr.meta.clone(),
                key: Box::new(expr_from_ir(&expr.key)),
                value: Box::new(expr_from_ir(&expr.value)),
                fors: expr
                    .fors
                    .iter()
                    .map(|comp| ComprehensionFor {
                        meta: comp.meta.clone(),
                        target: expr_from_ir(&comp.target),
                        iter: expr_from_ir(&comp.iter),
                        ifs: comp.ifs.iter().map(expr_from_ir).collect(),
                    })
                    .collect(),
            }),
        }),
    }
}

fn pattern_to_ir(pattern: &Pattern) -> IrPattern {
    match pattern {
        Pattern::Wildcard(meta) => IrPattern::Wildcard(meta.clone()),
        Pattern::Identifier(pattern) => IrPattern::Identifier(pattern.clone()),
        Pattern::Literal(pattern) => IrPattern::Literal(pattern.clone()),
    }
}

fn pattern_from_ir(pattern: &IrPattern) -> Pattern {
    match pattern {
        IrPattern::Wildcard(meta) => Pattern::Wildcard(meta.clone()),
        IrPattern::Identifier(pattern) => Pattern::Identifier(pattern.clone()),
        IrPattern::Literal(pattern) => Pattern::Literal(pattern.clone()),
    }
}

struct Lexer {
    chars: Peekable<Chars<'static>>,
    source: String,
    offset: usize,
    line: usize,
    column: usize,
    paren_depth: usize,
    indent_width: Option<usize>,
    at_line_start: bool,
    line_has_content: bool,
    tokens: Vec<LexToken>,
}

struct LexedSource {
    tokens: Vec<LexToken>,
    indent_width: usize,
}

impl Lexer {
    fn new(source: String) -> Self {
        let leaked: &'static str = Box::leak(source.clone().into_boxed_str());
        Self {
            chars: leaked.chars().peekable(),
            source,
            offset: 0,
            line: 1,
            column: 1,
            paren_depth: 0,
            indent_width: None,
            at_line_start: true,
            line_has_content: false,
            tokens: Vec::new(),
        }
    }

    fn lex(&mut self) -> Result<LexedSource, ParseError> {
        while self.peek_char().is_some() {
            if self.at_line_start && self.paren_depth == 0 {
                self.lex_indent();
                self.at_line_start = false;
                self.line_has_content = false;
                if self.peek_char().is_none() {
                    break;
                }
            }
            let current = self.peek_char().unwrap();
            match current {
                '\n' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.paren_depth > 0 {
                        self.push_token(TokenKind::RawWhitespace("\n".to_string()), start);
                    } else {
                        if !self.line_has_content {
                            self.tokens.push(LexToken {
                                kind: TokenKind::Blank(BlankSource::Source),
                                span: Span::join(start, start),
                                raw: String::new(),
                            });
                        }
                        self.push_token(TokenKind::Newline, start);
                        self.at_line_start = true;
                    }
                }
                '#' => {
                    self.lex_comment();
                }
                ' ' | '\t' => {
                    self.lex_whitespace();
                }
                '0'..='9' => {
                    self.lex_number();
                }
                '"' | '\'' => {
                    self.lex_string()?;
                }
                'a'..='z' | 'A'..='Z' | '_' => {
                    self.lex_identifier();
                }
                '(' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_add(1);
                    self.push_token(TokenKind::LParen, start);
                }
                ')' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_sub(1);
                    self.push_token(TokenKind::RParen, start);
                }
                '[' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_add(1);
                    self.push_token(TokenKind::LBracket, start);
                }
                ']' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_sub(1);
                    self.push_token(TokenKind::RBracket, start);
                }
                '{' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_add(1);
                    self.push_token(TokenKind::LBrace, start);
                }
                '}' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.paren_depth = self.paren_depth.saturating_sub(1);
                    self.push_token(TokenKind::RBrace, start);
                }
                '.' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Dot, start);
                }
                ':' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Colon, start);
                }
                ',' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Comma, start);
                }
                '=' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::Eq), start);
                    } else {
                        self.push_token(TokenKind::Operator(Operator::Assign), start);
                    }
                }
                '!' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::NotEq), start);
                    } else {
                        return Err(self.error("unexpected character '!'"));
                    }
                }
                '<' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::LtEq), start);
                    } else {
                        self.push_token(TokenKind::Operator(Operator::Lt), start);
                    }
                }
                '>' => {
                    let start = self.current_position();
                    self.advance_char();
                    if self.consume_char('=') {
                        self.push_token(TokenKind::Operator(Operator::GtEq), start);
                    } else {
                        self.push_token(TokenKind::Operator(Operator::Gt), start);
                    }
                }
                '+' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Plus), start);
                }
                '-' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Minus), start);
                }
                '*' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Star), start);
                }
                '/' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Slash), start);
                }
                '%' => {
                    let start = self.current_position();
                    self.advance_char();
                    self.push_token(TokenKind::Operator(Operator::Percent), start);
                }
                _ => {
                    return Err(self.error(format!("unexpected character '{current}'")));
                }
            }
        }
        let end = self.current_position();
        self.push_token(TokenKind::Eof, end);
        Ok(LexedSource {
            tokens: std::mem::take(&mut self.tokens),
            indent_width: self.indent_width.unwrap_or(4),
        })
    }

    fn lex_indent(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        let mut width = 0usize;
        while let Some(ch) = self.peek_char() {
            if ch == ' ' {
                raw.push(ch);
                width += 1;
                self.advance_char();
            } else if ch == '\t' {
                raw.push(ch);
                width += 4;
                self.advance_char();
            } else {
                break;
            }
        }
        if self.indent_width.is_none() && width > 0 {
            self.indent_width = Some(width);
        }
        self.push_token(TokenKind::Indentation(width), start);
    }

    fn lex_whitespace(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch == ' ' || ch == '\t' {
                raw.push(ch);
                self.advance_char();
            } else {
                break;
            }
        }
        if !raw.is_empty() {
            self.push_token(TokenKind::RawWhitespace(raw), start);
        }
    }

    fn lex_comment(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch == '\n' {
                break;
            }
            raw.push(ch);
            self.advance_char();
        }
        let text = raw.trim_start_matches('#').to_string();
        self.push_token(TokenKind::Comment(text), start);
    }

    fn lex_number(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() || ch == '.' {
                raw.push(ch);
                self.advance_char();
            } else {
                break;
            }
        }
        self.push_token(TokenKind::Number(NumberLiteral { raw }), start);
    }

    fn lex_string(&mut self) -> Result<(), ParseError> {
        let start = self.current_position();
        let quote = self.peek_char().unwrap();
        let quote_style = if quote == '"' {
            QuoteStyle::Double
        } else {
            QuoteStyle::Single
        };
        self.advance_char();
        let mut raw = String::new();
        raw.push(quote);
        let mut value = String::new();
        let mut escaped = false;
        let mut escaped_any = false;
        while let Some(ch) = self.peek_char() {
            if escaped {
                value.push(ch);
                raw.push(ch);
                escaped = false;
                self.advance_char();
                continue;
            }
            if ch == '\\' {
                escaped = true;
                escaped_any = true;
                raw.push(ch);
                self.advance_char();
                continue;
            }
            if ch == quote {
                raw.push(ch);
                self.advance_char();
                let literal = StringLiteral {
                    raw,
                    value,
                    quote: quote_style,
                    escaped: escaped_any,
                };
                self.push_token(TokenKind::String(literal), start);
                return Ok(());
            }
            value.push(ch);
            raw.push(ch);
            self.advance_char();
        }
        Err(self.error("unterminated string"))
    }

    fn lex_identifier(&mut self) {
        let start = self.current_position();
        let mut raw = String::new();
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_alphanumeric() || ch == '_' {
                raw.push(ch);
                self.advance_char();
            } else {
                break;
            }
        }
        let kind = match raw.as_str() {
            "if" => TokenKind::Keyword(Keyword::If),
            "elif" => TokenKind::Keyword(Keyword::Elif),
            "else" => TokenKind::Keyword(Keyword::Else),
            "while" => TokenKind::Keyword(Keyword::While),
            "for" => TokenKind::Keyword(Keyword::For),
            "in" => TokenKind::Keyword(Keyword::In),
            "is" => TokenKind::Keyword(Keyword::Is),
            "lambda" => TokenKind::Keyword(Keyword::Lambda),
            "match" => TokenKind::Keyword(Keyword::Match),
            "case" => TokenKind::Keyword(Keyword::Case),
            "pass" => TokenKind::Keyword(Keyword::Pass),
            "and" => TokenKind::Keyword(Keyword::And),
            "or" => TokenKind::Keyword(Keyword::Or),
            "not" => TokenKind::Keyword(Keyword::Not),
            "True" => TokenKind::Keyword(Keyword::True),
            "False" => TokenKind::Keyword(Keyword::False),
            "None" => TokenKind::Keyword(Keyword::None),
            _ => TokenKind::Identifier(raw),
        };
        self.push_token(kind, start);
    }

    fn push_token(&mut self, kind: TokenKind, start: Position) {
        let is_content = !matches!(
            kind,
            TokenKind::RawWhitespace(_)
                | TokenKind::Comment(_)
                | TokenKind::Blank(_)
                | TokenKind::Indentation(_)
                | TokenKind::Newline
                | TokenKind::Eof
        );
        let end = self.current_position();
        let raw = self
            .source
            .get(start.offset..end.offset)
            .unwrap_or("")
            .to_string();
        self.tokens.push(LexToken {
            kind: kind.clone(),
            span: Span::join(start, end),
            raw,
        });
        if is_content {
            self.line_has_content = true;
        }
    }

    fn peek_char(&mut self) -> Option<char> {
        self.chars.peek().copied()
    }

    fn advance_char(&mut self) {
        if let Some(ch) = self.chars.next() {
            self.offset += ch.len_utf8();
            if ch == '\n' {
                self.line += 1;
                self.column = 1;
            } else {
                self.column += 1;
            }
        }
    }

    fn consume_char(&mut self, target: char) -> bool {
        if self.peek_char() == Some(target) {
            self.advance_char();
            return true;
        }
        false
    }

    fn current_position(&self) -> Position {
        Position {
            line: self.line,
            column: self.column,
            offset: self.offset,
        }
    }

    fn error(&self, message: impl Into<String>) -> ParseError {
        ParseError {
            message: message.into(),
            span: Span::join(self.current_position(), self.current_position()),
        }
    }
}

fn insert_indent_tokens(tokens: Vec<LexToken>) -> Vec<LexToken> {
    let mut output = Vec::new();
    let mut indent_stack = vec![0usize];
    let mut pending_indent: Option<(usize, Position, Position, String)> = None;
    for token in tokens {
        match token.kind {
            TokenKind::Indentation(level) => {
                pending_indent = Some((level, token.span.start, token.span.end, token.raw));
            }
            TokenKind::Newline => {
                if let Some((_level, start, end, raw)) = pending_indent.take() {
                    output.push(LexToken {
                        kind: TokenKind::RawWhitespace("".to_string()),
                        span: Span::join(start, end),
                        raw,
                    });
                }
                output.push(token);
            }
            TokenKind::Eof => {
                if let Some((_level, start, end, raw)) = pending_indent.take() {
                    output.push(LexToken {
                        kind: TokenKind::RawWhitespace("".to_string()),
                        span: Span::join(start, end),
                        raw,
                    });
                }
                while indent_stack.len() > 1 {
                    indent_stack.pop();
                    output.push(LexToken {
                        kind: TokenKind::Dedent { level: 0 },
                        span: token.span,
                        raw: String::new(),
                    });
                }
                output.push(token);
            }
            _ => {
                if let Some((level, start, end, raw)) = pending_indent.take() {
                    if !token.kind.is_trivia() && token.kind != TokenKind::Newline {
                        let current = *indent_stack.last().unwrap_or(&0);
                        if level > current && level > 0 {
                            indent_stack.push(level);
                            output.push(LexToken {
                                kind: TokenKind::Indent { level },
                                span: Span::join(start, end),
                                raw: String::new(),
                            });
                        } else if level < current {
                            while let Some(last) = indent_stack.last().copied() {
                                if level >= last {
                                    break;
                                }
                                indent_stack.pop();
                                output.push(LexToken {
                                    kind: TokenKind::Dedent { level },
                                    span: Span::join(start, end),
                                    raw: String::new(),
                                });
                            }
                        }
                        output.push(LexToken {
                            kind: TokenKind::RawWhitespace("".to_string()),
                            span: Span::join(start, end),
                            raw,
                        });
                    } else {
                        output.push(LexToken {
                            kind: TokenKind::RawWhitespace("".to_string()),
                            span: Span::join(start, end),
                            raw,
                        });
                    }
                }
                output.push(token);
            }
        }
    }
    output
}

fn attach_trivia(raw_tokens: Vec<LexToken>) -> Vec<Token> {
    let mut tokens: Vec<Token> = Vec::new();
    let mut pending_leading: Vec<Trivia> = Vec::new();
    let mut line_has_token = false;
    let mut last_sig_index: Option<usize> = None;
    for token in raw_tokens {
        if token.kind.is_trivia() {
            let trivia = trivia_from_token(&token);
            if line_has_token {
                if let Some(idx) = last_sig_index {
                    tokens[idx].trailing_trivia.push(trivia);
                } else {
                    pending_leading.push(trivia);
                }
            } else {
                pending_leading.push(trivia);
            }
            continue;
        }
        if token.kind == TokenKind::Newline {
            tokens.push(Token {
                kind: token.kind,
                span: token.span,
                raw: token.raw,
                leading_trivia: Vec::new(),
                trailing_trivia: Vec::new(),
            });
            last_sig_index = Some(tokens.len() - 1);
            line_has_token = false;
            continue;
        }
        let leading = std::mem::take(&mut pending_leading);
        tokens.push(Token {
            kind: token.kind,
            span: token.span,
            raw: token.raw,
            leading_trivia: leading,
            trailing_trivia: Vec::new(),
        });
        last_sig_index = Some(tokens.len() - 1);
        let is_structural = matches!(
            tokens.last().map(|token| &token.kind),
            Some(TokenKind::Indent { .. })
                | Some(TokenKind::Dedent { .. })
                | Some(TokenKind::Newline)
        );
        line_has_token = !is_structural;
    }
    if !pending_leading.is_empty() {
        if let Some(last) = tokens.last_mut() {
            if last.kind == TokenKind::Eof {
                last.leading_trivia.extend(pending_leading);
            } else {
                last.trailing_trivia.extend(pending_leading);
            }
        }
    }
    tokens
}

fn trivia_from_token(token: &LexToken) -> Trivia {
    let kind = match &token.kind {
        TokenKind::Comment(text) => TriviaKind::Comment(text.clone()),
        TokenKind::RawWhitespace(text) => TriviaKind::RawWhitespace(text.clone()),
        TokenKind::Blank(source) => TriviaKind::Blank(source.clone()),
        TokenKind::Indentation(_) => TriviaKind::RawWhitespace(token.raw.clone()),
        _ => TriviaKind::RawWhitespace(token.raw.clone()),
    };
    Trivia {
        kind,
        span: token.span,
    }
}

struct Parser {
    tokens: Vec<Token>,
    index: usize,
    next_id: u64,
    config: ParserConfig,
    indent_width: usize,
    last_span: Span,
}

impl Parser {
    fn new(tokens: Vec<Token>, config: ParserConfig, indent_width: usize) -> Self {
        let last_span = tokens.last().map(|token| token.span).unwrap_or_default();
        Self {
            tokens,
            index: 0,
            next_id: 1,
            config,
            indent_width,
            last_span,
        }
    }

    fn parse_program(&mut self) -> Result<Program, ParseError> {
        let start = self.index;
        let mut body = Vec::new();
        while !self.check_tag(TokenTag::Eof) {
            if self.check_tag(TokenTag::Newline) {
                if self.peek_kind_offset(1).tag() == TokenTag::Eof {
                    self.advance();
                    break;
                }
                let newline_index = self.index;
                self.advance();
                let meta = self.node_meta(newline_index, newline_index);
                body.push(Stmt::Empty(EmptyStmt {
                    meta,
                    source: BlankSource::Source,
                }));
                continue;
            }
            body.push(self.parse_stmt()?);
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Program {
            meta,
            indent_width: self.indent_width,
            body,
            tokens: Vec::new(),
            raw_tokens: Vec::new(),
            dirty: false,
        })
    }

    fn parse_stmt(&mut self) -> Result<Stmt, ParseError> {
        match self.peek_kind() {
            TokenKind::Keyword(Keyword::If) => self.parse_if_stmt(),
            TokenKind::Keyword(Keyword::While) => self.parse_while_stmt(),
            TokenKind::Keyword(Keyword::For) => self.parse_for_stmt(),
            TokenKind::Keyword(Keyword::Match) => self.parse_match_stmt(),
            TokenKind::Keyword(Keyword::Pass) => self.parse_pass_stmt(),
            TokenKind::Keyword(Keyword::Elif) | TokenKind::Keyword(Keyword::Else) => {
                Err(self.error("elif/else must follow if"))
            }
            TokenKind::Keyword(Keyword::Case) => Err(self.error("case outside match")),
            _ => self.parse_simple_stmt(),
        }
    }

    fn parse_pass_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Pass)?;
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Pass(PassStmt { meta }))
    }

    fn parse_simple_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        let expr = self.parse_expression()?;
        if self.match_operator(Operator::Assign) {
            let value = self.parse_expression_no_generator()?;
            self.expect_line_end()?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Stmt::Assign(AssignStmt {
                meta,
                target: expr,
                value,
            }));
        }
        self.expect_line_end()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Expr(ExprStmt { meta, expr }))
    }

    fn parse_if_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::If)?;
        let condition = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let mut elifs = Vec::new();
        while self.match_keyword(Keyword::Elif) {
            let elif_start = self.index.saturating_sub(1);
            let elif_condition = self.parse_expression()?;
            self.expect_tag(TokenTag::Colon)?;
            let elif_body = self.parse_block()?;
            let meta = self.node_meta(elif_start, self.index.saturating_sub(1));
            elifs.push(ElifStmt {
                meta,
                condition: elif_condition,
                body: elif_body,
            });
        }
        let else_body = if self.match_keyword(Keyword::Else) {
            self.expect_tag(TokenTag::Colon)?;
            Some(self.parse_block()?)
        } else {
            None
        };
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::If(IfStmt {
            meta,
            condition,
            body,
            elifs,
            else_body,
        }))
    }

    fn parse_while_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::While)?;
        let condition = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::While(WhileStmt {
            meta,
            condition,
            body,
        }))
    }

    fn parse_for_stmt(&mut self) -> Result<Stmt, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::For)?;
        let target = self.parse_expression()?;
        self.expect_keyword(Keyword::In)?;
        let iterable = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::For(ForStmt {
            meta,
            target,
            iterable,
            body,
        }))
    }

    fn parse_match_stmt(&mut self) -> Result<Stmt, ParseError> {
        if !self.config.features.match_stmt {
            return Err(self.error("match is disabled"));
        }
        let start = self.index;
        self.expect_keyword(Keyword::Match)?;
        let subject = self.parse_expression()?;
        self.expect_tag(TokenTag::Colon)?;
        let cases = self.parse_case_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Stmt::Match(MatchStmt {
            meta,
            subject,
            cases,
        }))
    }

    fn parse_case_block(&mut self) -> Result<CaseBlock, ParseError> {
        let start = self.index;
        self.expect_tag(TokenTag::Newline)?;
        let indent = self.expect_indent()?;
        let mut cases = Vec::new();
        while !self.check_tag(TokenTag::Dedent) && !self.check_tag(TokenTag::Eof) {
            if self.match_tag(TokenTag::Newline) {
                continue;
            }
            cases.push(self.parse_case_stmt()?);
        }
        self.expect_tag(TokenTag::Dedent)?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(CaseBlock {
            meta,
            indent_level: indent,
            cases,
        })
    }

    fn parse_case_stmt(&mut self) -> Result<MatchCase, ParseError> {
        let start = self.index;
        self.expect_keyword(Keyword::Case)?;
        let pattern = self.parse_pattern()?;
        self.expect_tag(TokenTag::Colon)?;
        let body = self.parse_block()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(MatchCase { meta, pattern, body })
    }

    fn parse_pattern(&mut self) -> Result<Pattern, ParseError> {
        let start = self.index;
        let expr = self.parse_expression()?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        match expr {
            Expr::Identifier(identifier) if identifier.name == "_" => {
                Ok(Pattern::Wildcard(meta))
            }
            Expr::Identifier(identifier) => Ok(Pattern::Identifier(PatternIdentifier {
                meta,
                name: identifier.name,
            })),
            Expr::Literal(literal) => Ok(Pattern::Literal(PatternLiteral {
                meta,
                literal: literal.literal,
            })),
            _ => Err(self.error("unsupported match pattern")),
        }
    }

    fn parse_block(&mut self) -> Result<Block, ParseError> {
        let start = self.index;
        self.expect_tag(TokenTag::Newline)?;
        let mut pending_blank = Vec::new();
        while self.check_tag(TokenTag::Newline) {
            let newline_index = self.index;
            self.advance();
            pending_blank.push(newline_index);
        }
        let indent = self.expect_indent()?;
        let mut statements = Vec::new();
        for newline_index in pending_blank {
            let meta = self.node_meta(newline_index, newline_index);
            statements.push(Stmt::Empty(EmptyStmt {
                meta,
                source: BlankSource::Source,
            }));
        }
        while !self.check_tag(TokenTag::Dedent) && !self.check_tag(TokenTag::Eof) {
            if self.check_tag(TokenTag::Newline) {
                let newline_index = self.index;
                self.advance();
                let meta = self.node_meta(newline_index, newline_index);
                statements.push(Stmt::Empty(EmptyStmt {
                    meta,
                    source: BlankSource::Source,
                }));
                continue;
            }
            statements.push(self.parse_stmt()?);
        }
        self.expect_tag(TokenTag::Dedent)?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Block {
            meta,
            indent_level: indent,
            statements,
        })
    }

    fn parse_expression(&mut self) -> Result<Expr, ParseError> {
        self.parse_expression_with_generator(true, true)
    }

    fn parse_expression_no_generator(&mut self) -> Result<Expr, ParseError> {
        self.parse_expression_with_generator(false, true)
    }

    fn parse_expression_no_if_expr(&mut self) -> Result<Expr, ParseError> {
        self.parse_expression_with_generator(false, false)
    }

    fn parse_expression_with_generator(
        &mut self,
        allow_generator: bool,
        allow_if_expr: bool,
    ) -> Result<Expr, ParseError> {
        let start = self.index;
        let expr = self.parse_lambda_with_if_expr(allow_if_expr)?;
        if allow_generator && self.match_keyword(Keyword::For) {
            let fors = self.parse_comprehension_fors()?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Comprehension(ComprehensionExpr::Generator(
                ComprehensionGeneratorExpr {
                    meta,
                    element: Box::new(expr),
                    fors,
                },
            )));
        }
        Ok(expr)
    }

    fn parse_lambda_with_if_expr(&mut self, allow_if_expr: bool) -> Result<Expr, ParseError> {
        if self.match_keyword(Keyword::Lambda) {
            let start = self.index.saturating_sub(1);
            let mut params = Vec::new();
            if !self.check_tag(TokenTag::Colon) {
                loop {
                    params.push(self.expect_identifier()?);
                    if self.match_tag(TokenTag::Comma) {
                        if self.check_tag(TokenTag::Colon) {
                            break;
                        }
                        continue;
                    }
                    break;
                }
            }
            self.expect_tag(TokenTag::Colon)?;
            let body = self.parse_expression_with_generator(true, true)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Lambda(LambdaExpr {
                meta,
                params,
                body: Box::new(body),
            }));
        }
        self.parse_if_expr(allow_if_expr)
    }

    fn parse_if_expr(&mut self, allow_if_expr: bool) -> Result<Expr, ParseError> {
        let start = self.index;
        let body = self.parse_bool_or()?;
        if allow_if_expr && self.match_keyword(Keyword::If) {
            let condition = self.parse_bool_or()?;
            self.expect_keyword(Keyword::Else)?;
            let else_body = self.parse_if_expr(true)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::IfExpr(IfExpr {
                meta,
                body: Box::new(body),
                condition: Box::new(condition),
                else_body: Box::new(else_body),
            }));
        }
        Ok(body)
    }

    fn parse_bool_or(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        let mut values = vec![self.parse_bool_and()?];
        while self.match_keyword(Keyword::Or) {
            values.push(self.parse_bool_and()?);
        }
        if values.len() == 1 {
            return Ok(values.remove(0));
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::BoolOp(BoolOpExpr {
            meta,
            op: BoolOp::Or,
            values,
        }))
    }

    fn parse_bool_and(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        let mut values = vec![self.parse_compare()?];
        while self.match_keyword(Keyword::And) {
            values.push(self.parse_compare()?);
        }
        if values.len() == 1 {
            return Ok(values.remove(0));
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::BoolOp(BoolOpExpr {
            meta,
            op: BoolOp::And,
            values,
        }))
    }

    fn parse_compare(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        let left = self.parse_binary(0)?;
        let mut ops = Vec::new();
        let mut comparators = Vec::new();
        while let Some(op) = self.take_compare_op() {
            ops.push(op);
            comparators.push(self.parse_binary(0)?);
        }
        if ops.is_empty() {
            return Ok(left);
        }
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::Compare(CompareExpr {
            meta,
            left: Box::new(left),
            ops,
            comparators,
        }))
    }

    fn parse_binary(&mut self, min_prec: u8) -> Result<Expr, ParseError> {
        let mut left = self.parse_unary()?;
        loop {
            let info = match self.peek_binary_op_info() {
                Some(info) => info,
                None => break,
            };
            if info.precedence < min_prec {
                break;
            }
            let op_meta_start = self.index;
            self.advance();
            let next_min = match info.assoc {
                Associativity::Left => info.precedence + 1,
                Associativity::Right => info.precedence,
            };
            let right = self.parse_binary(next_min)?;
            let meta = self.node_meta(op_meta_start, self.index.saturating_sub(1));
            left = Expr::Binary(BinaryExpr {
                meta,
                left: Box::new(left),
                op: info.op,
                right: Box::new(right),
            });
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Expr, ParseError> {
        match self.peek_kind() {
            TokenKind::Operator(Operator::Minus) => {
                let start = self.index;
                self.advance();
                let expr = self.parse_unary()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Unary(UnaryExpr {
                    meta,
                    op: UnaryOp::Neg,
                    expr: Box::new(expr),
                }))
            }
            TokenKind::Keyword(Keyword::Not) => {
                let start = self.index;
                self.advance();
                let expr = self.parse_unary()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Unary(UnaryExpr {
                    meta,
                    op: UnaryOp::Not,
                    expr: Box::new(expr),
                }))
            }
            _ => self.parse_postfix(),
        }
    }

    fn parse_postfix(&mut self) -> Result<Expr, ParseError> {
        let mut expr = self.parse_primary()?;
        loop {
            if self.match_tag(TokenTag::LParen) {
                let start = self.index.saturating_sub(1);
                let mut args = Vec::new();
                if !self.check_tag(TokenTag::RParen) {
                    loop {
                        args.push(self.parse_expression()?);
                        if self.match_tag(TokenTag::Comma) {
                            if self.check_tag(TokenTag::RParen) {
                                break;
                            }
                            continue;
                        }
                        break;
                    }
                }
                self.expect_tag(TokenTag::RParen)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                expr = Expr::Call(CallExpr {
                    meta,
                    callee: Box::new(expr),
                    args,
                });
                continue;
            }
            if self.match_tag(TokenTag::Dot) {
                let start = self.index.saturating_sub(1);
                let name = self.expect_identifier()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                expr = Expr::Attribute(AttributeExpr {
                    meta,
                    value: Box::new(expr),
                    attr: name,
                });
                continue;
            }
            if self.match_tag(TokenTag::LBracket) {
                let start = self.index.saturating_sub(1);
                let index_expr = self.parse_expression()?;
                self.expect_tag(TokenTag::RBracket)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                expr = Expr::Subscript(SubscriptExpr {
                    meta,
                    value: Box::new(expr),
                    index: Box::new(index_expr),
                });
                continue;
            }
            break;
        }
        Ok(expr)
    }

    fn parse_assignment_target(&mut self) -> Result<Expr, ParseError> {
        self.parse_postfix()
    }

    fn parse_primary(&mut self) -> Result<Expr, ParseError> {
        match self.peek_kind() {
            TokenKind::Identifier(_) => {
                let start = self.index;
                let name = self.expect_identifier()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Identifier(IdentifierExpr { meta, name }))
            }
            TokenKind::Number(_) => {
                let start = self.index;
                let literal = self.expect_number()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr { meta, literal }))
            }
            TokenKind::String(_) => {
                let start = self.index;
                let literal = self.expect_string()?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr { meta, literal }))
            }
            TokenKind::Keyword(Keyword::True) => {
                let start = self.index;
                self.advance();
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr {
                    meta,
                    literal: Literal::Bool(true),
                }))
            }
            TokenKind::Keyword(Keyword::False) => {
                let start = self.index;
                self.advance();
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr {
                    meta,
                    literal: Literal::Bool(false),
                }))
            }
            TokenKind::Keyword(Keyword::None) => {
                let start = self.index;
                self.advance();
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                Ok(Expr::Literal(LiteralExpr {
                    meta,
                    literal: Literal::None,
                }))
            }
            TokenKind::LParen => self.parse_grouped_or_tuple(),
            TokenKind::LBracket => self.parse_list_expr(),
            TokenKind::LBrace => self.parse_dict_or_set_expr(),
            _ => Err(self.error("unexpected token in expression")),
        }
    }

    fn parse_grouped_or_tuple(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        self.expect_tag(TokenTag::LParen)?;
        let mut elements = Vec::new();
        let mut is_tuple = false;
        if !self.check_tag(TokenTag::RParen) {
            elements.push(self.parse_expression_no_generator()?);
            if self.match_keyword(Keyword::For) {
                let fors = self.parse_comprehension_fors()?;
                self.expect_tag(TokenTag::RParen)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                let inner = Expr::Comprehension(ComprehensionExpr::Generator(
                    ComprehensionGeneratorExpr {
                        meta: meta.clone(),
                        element: Box::new(elements.remove(0)),
                        fors,
                    },
                ));
                return Ok(Expr::Grouped(GroupedExpr {
                    meta,
                    expr: Box::new(inner),
                }));
            }
            if self.match_tag(TokenTag::Comma) {
                is_tuple = true;
                while !self.check_tag(TokenTag::RParen) {
                    elements.push(self.parse_expression_no_generator()?);
                    if !self.match_tag(TokenTag::Comma) {
                        break;
                    }
                }
            }
        }
        self.expect_tag(TokenTag::RParen)?;
        let inner = if elements.len() == 1 && !is_tuple {
            elements.remove(0)
        } else {
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            Expr::Tuple(TupleExpr {
                meta,
                elements,
            })
        };
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::Grouped(GroupedExpr {
            meta,
            expr: Box::new(inner),
        }))
    }

    fn parse_list_expr(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        self.expect_tag(TokenTag::LBracket)?;
        if self.match_tag(TokenTag::RBracket) {
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::List(ListExpr {
                meta,
                elements: Vec::new(),
            }));
        }
        let first = self.parse_expression_no_generator()?;
        if self.match_keyword(Keyword::For) {
            let fors = self.parse_comprehension_fors()?;
            self.expect_tag(TokenTag::RBracket)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Comprehension(ComprehensionExpr::List(
                ComprehensionListExpr {
                    meta,
                    element: Box::new(first),
                    fors,
                },
            )));
        }
        let mut elements = vec![first];
        while self.match_tag(TokenTag::Comma) {
            if self.check_tag(TokenTag::RBracket) {
                break;
            }
            elements.push(self.parse_expression_no_generator()?);
        }
        self.expect_tag(TokenTag::RBracket)?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::List(ListExpr { meta, elements }))
    }

    fn parse_dict_or_set_expr(&mut self) -> Result<Expr, ParseError> {
        let start = self.index;
        self.expect_tag(TokenTag::LBrace)?;
        if self.match_tag(TokenTag::RBrace) {
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Dict(DictExpr {
                meta,
                entries: Vec::new(),
            }));
        }
        let entry_start = self.index;
        let first = self.parse_expression_no_generator()?;
        if self.match_tag(TokenTag::Colon) {
            let value = self.parse_expression()?;
            if self.match_keyword(Keyword::For) {
                let fors = self.parse_comprehension_fors()?;
                self.expect_tag(TokenTag::RBrace)?;
                let meta = self.node_meta(start, self.index.saturating_sub(1));
                return Ok(Expr::Comprehension(ComprehensionExpr::Dict(
                    ComprehensionDictExpr {
                        meta,
                        key: Box::new(first),
                        value: Box::new(value),
                        fors,
                    },
                )));
            }
            let mut entries = vec![DictEntry {
                meta: self.node_meta(entry_start, self.index.saturating_sub(1)),
                key: first,
                value,
            }];
            while self.match_tag(TokenTag::Comma) {
                if self.check_tag(TokenTag::RBrace) {
                    break;
                }
                let entry_start = self.index;
                let key = self.parse_expression_no_generator()?;
                self.expect_tag(TokenTag::Colon)?;
                let entry_value = self.parse_expression_no_generator()?;
                entries.push(DictEntry {
                    meta: self.node_meta(entry_start, self.index.saturating_sub(1)),
                    key,
                    value: entry_value,
                });
            }
            self.expect_tag(TokenTag::RBrace)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Dict(DictExpr { meta, entries }));
        }
        if self.match_keyword(Keyword::For) {
            let fors = self.parse_comprehension_fors()?;
            self.expect_tag(TokenTag::RBrace)?;
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            return Ok(Expr::Comprehension(ComprehensionExpr::Set(
                ComprehensionSetExpr {
                    meta,
                    element: Box::new(first),
                    fors,
                },
            )));
        }
        let mut elements = vec![first];
        while self.match_tag(TokenTag::Comma) {
            if self.check_tag(TokenTag::RBrace) {
                break;
            }
            elements.push(self.parse_expression_no_generator()?);
        }
        self.expect_tag(TokenTag::RBrace)?;
        let meta = self.node_meta(start, self.index.saturating_sub(1));
        Ok(Expr::Set(SetExpr { meta, elements }))
    }

    fn parse_comprehension_fors(&mut self) -> Result<Vec<ComprehensionFor>, ParseError> {
        let mut fors = Vec::new();
        loop {
            let start = self.index.saturating_sub(1);
            let target = self.parse_assignment_target()?;
            self.expect_keyword(Keyword::In)?;
            let iter = self.parse_expression_no_if_expr()?;
            let mut ifs = Vec::new();
            while self.match_keyword(Keyword::If) {
                ifs.push(self.parse_expression_no_generator()?);
            }
            let meta = self.node_meta(start, self.index.saturating_sub(1));
            fors.push(ComprehensionFor {
                meta,
                target,
                iter,
                ifs,
            });
            if self.match_keyword(Keyword::For) {
                continue;
            }
            break;
        }
        Ok(fors)
    }

    fn peek_binary_op_info(&self) -> Option<BinaryOpInfo> {
        match self.peek_kind() {
            TokenKind::Operator(Operator::Plus) => Some(BinaryOpInfo {
                op: BinaryOp::Add,
                precedence: BinaryOp::Add.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Minus) => Some(BinaryOpInfo {
                op: BinaryOp::Sub,
                precedence: BinaryOp::Sub.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Star) => Some(BinaryOpInfo {
                op: BinaryOp::Mul,
                precedence: BinaryOp::Mul.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Slash) => Some(BinaryOpInfo {
                op: BinaryOp::Div,
                precedence: BinaryOp::Div.precedence(),
                assoc: Associativity::Left,
            }),
            TokenKind::Operator(Operator::Percent) => Some(BinaryOpInfo {
                op: BinaryOp::Mod,
                precedence: BinaryOp::Mod.precedence(),
                assoc: Associativity::Left,
            }),
            _ => None,
        }
    }

    fn take_compare_op(&mut self) -> Option<CompareOp> {
        match self.peek_kind() {
            TokenKind::Operator(Operator::Eq) => {
                self.advance();
                Some(CompareOp::Eq)
            }
            TokenKind::Operator(Operator::NotEq) => {
                self.advance();
                Some(CompareOp::NotEq)
            }
            TokenKind::Operator(Operator::Lt) => {
                self.advance();
                Some(CompareOp::Lt)
            }
            TokenKind::Operator(Operator::LtEq) => {
                self.advance();
                Some(CompareOp::LtEq)
            }
            TokenKind::Operator(Operator::Gt) => {
                self.advance();
                Some(CompareOp::Gt)
            }
            TokenKind::Operator(Operator::GtEq) => {
                self.advance();
                Some(CompareOp::GtEq)
            }
            TokenKind::Keyword(Keyword::In) => {
                self.advance();
                Some(CompareOp::In)
            }
            TokenKind::Keyword(Keyword::Is) => {
                self.advance();
                if self.match_keyword(Keyword::Not) {
                    Some(CompareOp::IsNot)
                } else {
                    Some(CompareOp::Is)
                }
            }
            TokenKind::Keyword(Keyword::Not) => {
                if matches!(self.peek_kind_offset(1), TokenKind::Keyword(Keyword::In)) {
                    self.advance();
                    self.advance();
                    Some(CompareOp::NotIn)
                } else {
                    None
                }
            }
            _ => None,
        }
    }

    fn expect_tag(&mut self, tag: TokenTag) -> Result<Token, ParseError> {
        if self.check_tag(tag) {
            Ok(self.advance())
        } else {
            Err(self.error(format!("expected {:?}", tag)))
        }
    }

    fn expect_line_end(&mut self) -> Result<(), ParseError> {
        if self.match_tag(TokenTag::Newline) {
            return Ok(());
        }
        if self.check_tag(TokenTag::Dedent) {
            return Ok(());
        }
        if self.check_tag(TokenTag::Eof) {
            return Ok(());
        }
        Err(self.error("expected line end"))
    }

    fn expect_indent(&mut self) -> Result<usize, ParseError> {
        match self.peek_kind() {
            TokenKind::Indent { level } => {
                self.advance();
                if self.indent_width == 0 {
                    return Ok(level);
                }
                if level % self.indent_width != 0 {
                    return Err(self.error("invalid indent width"));
                }
                Ok(level / self.indent_width)
            }
            _ => Err(self.error("expected indent")),
        }
    }

    fn expect_identifier(&mut self) -> Result<String, ParseError> {
        match self.peek_kind() {
            TokenKind::Identifier(name) => {
                self.advance();
                Ok(name)
            }
            _ => Err(self.error("expected identifier")),
        }
    }

    fn expect_number(&mut self) -> Result<Literal, ParseError> {
        match self.peek_kind() {
            TokenKind::Number(literal) => {
                self.advance();
                Ok(Literal::Number(literal))
            }
            _ => Err(self.error("expected number")),
        }
    }

    fn expect_string(&mut self) -> Result<Literal, ParseError> {
        match self.peek_kind() {
            TokenKind::String(literal) => {
                self.advance();
                Ok(Literal::String(literal))
            }
            _ => Err(self.error("expected string")),
        }
    }

    fn expect_keyword(&mut self, keyword: Keyword) -> Result<(), ParseError> {
        match self.peek_kind() {
            TokenKind::Keyword(value) if value == keyword => {
                self.advance();
                Ok(())
            }
            _ => Err(self.error("expected keyword")),
        }
    }

    fn match_keyword(&mut self, keyword: Keyword) -> bool {
        match self.peek_kind() {
            TokenKind::Keyword(value) if value == keyword => {
                self.advance();
                true
            }
            _ => false,
        }
    }

    fn match_operator(&mut self, op: Operator) -> bool {
        match self.peek_kind() {
            TokenKind::Operator(value) if value == op => {
                self.advance();
                true
            }
            _ => false,
        }
    }

    fn match_tag(&mut self, tag: TokenTag) -> bool {
        if self.check_tag(tag) {
            self.advance();
            true
        } else {
            false
        }
    }

    fn check_tag(&self, tag: TokenTag) -> bool {
        self.peek_kind().tag() == tag
    }

    fn peek_kind(&self) -> TokenKind {
        self.tokens
            .get(self.index)
            .map(|token| token.kind.clone())
            .unwrap_or(TokenKind::Eof)
    }

    fn peek_kind_offset(&self, offset: usize) -> TokenKind {
        self.tokens
            .get(self.index.saturating_add(offset))
            .map(|token| token.kind.clone())
            .unwrap_or(TokenKind::Eof)
    }

    fn advance(&mut self) -> Token {
        let token = self.tokens[self.index].clone();
        self.index = self.index.saturating_add(1);
        self.last_span = token.span;
        token
    }

    fn error(&self, message: impl Into<String>) -> ParseError {
        let span = self
            .tokens
            .get(self.index)
            .map(|token| token.span)
            .unwrap_or(self.last_span);
        ParseError {
            message: message.into(),
            span,
        }
    }

    fn node_meta(&mut self, start: usize, end: usize) -> NodeMeta {
        let start_token = self.tokens.get(start);
        let end_token = self.tokens.get(end);
        let span = match (start_token, end_token) {
            (Some(start), Some(end)) => Span::join(start.span.start, end.span.end),
            (Some(start), None) => Span::join(start.span.start, start.span.end),
            _ => Span::default(),
        };
        let leading_trivia = start_token
            .map(|token| token.leading_trivia.clone())
            .unwrap_or_default();
        let trailing_trivia = end_token
            .map(|token| token.trailing_trivia.clone())
            .unwrap_or_default();
        let meta = NodeMeta {
            id: NodeId(self.next_id),
            span,
            token_range: TokenRange { start, end },
            leading_trivia,
            trailing_trivia,
        };
        self.next_id = self.next_id.saturating_add(1);
        meta
    }
}

fn render_lossless(tokens: &[LexToken]) -> String {
    let mut output = String::new();
    for token in tokens {
        output.push_str(&token.raw);
    }
    output
}

struct PrettyContext<'a> {
    tokens: Option<&'a [Token]>,
    reuse_token_ranges: bool,
}

fn render_pretty(program: &Program, config: RenderConfig) -> String {
    let mut lines = Vec::new();
    let context = PrettyContext {
        tokens: if config.reuse_token_ranges {
            Some(&program.tokens)
        } else {
            None
        },
        reuse_token_ranges: config.reuse_token_ranges,
    };
    for stmt in &program.body {
        render_stmt(stmt, 0, program.indent_width, &mut lines, &context);
    }
    let output = lines.join("\n");
    if output.is_empty() {
        output
    } else {
        format!("{output}\n")
    }
}

fn render_stmt(
    stmt: &Stmt,
    indent_level: usize,
    indent_width: usize,
    lines: &mut Vec<String>,
    context: &PrettyContext,
) {
    if context.reuse_token_ranges {
        if let Some(tokens) = context.tokens {
            if let Some(rendered) = render_token_range(tokens, &stmt_meta(stmt).token_range) {
                for line in rendered.split('\n') {
                    lines.push(line.to_string());
                }
                return;
            }
        }
    }
    let prefix = indent_str(indent_level * indent_width);
    match stmt {
        Stmt::If(stmt) => {
            lines.push(format!(
                "{prefix}if {}:",
                render_expr(&stmt.condition, 0)
            ));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
            for elif in &stmt.elifs {
                lines.push(format!(
                    "{prefix}elif {}:",
                    render_expr(&elif.condition, 0)
                ));
                render_block(&elif.body, indent_level + 1, indent_width, lines, context);
            }
            if let Some(body) = &stmt.else_body {
                lines.push(format!("{prefix}else:"));
                render_block(body, indent_level + 1, indent_width, lines, context);
            }
        }
        Stmt::While(stmt) => {
            lines.push(format!(
                "{prefix}while {}:",
                render_expr(&stmt.condition, 0)
            ));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
        }
        Stmt::For(stmt) => {
            lines.push(format!(
                "{prefix}for {} in {}:",
                render_expr(&stmt.target, 0),
                render_expr(&stmt.iterable, 0)
            ));
            render_block(&stmt.body, indent_level + 1, indent_width, lines, context);
        }
        Stmt::Match(stmt) => {
            lines.push(format!(
                "{prefix}match {}:",
                render_expr(&stmt.subject, 0)
            ));
            render_case_block(&stmt.cases, indent_level + 1, indent_width, lines, context);
        }
        Stmt::Assign(stmt) => {
            lines.push(format!(
                "{prefix}{} = {}",
                render_expr(&stmt.target, 0),
                render_expr(&stmt.value, 0)
            ));
        }
        Stmt::Expr(stmt) => {
            lines.push(format!("{prefix}{}", render_expr(&stmt.expr, 0)));
        }
        Stmt::Pass(_) => {
            lines.push(format!("{prefix}pass"));
        }
        Stmt::Empty(_) => lines.push(String::new()),
    }
}

fn render_block(
    block: &Block,
    indent_level: usize,
    indent_width: usize,
    lines: &mut Vec<String>,
    context: &PrettyContext,
) {
    if block.statements.is_empty() {
        lines.push(format!("{}pass", indent_str(indent_level * indent_width)));
        return;
    }
    for stmt in &block.statements {
        render_stmt(stmt, indent_level, indent_width, lines, context);
    }
}

fn render_case_block(
    block: &CaseBlock,
    indent_level: usize,
    indent_width: usize,
    lines: &mut Vec<String>,
    context: &PrettyContext,
) {
    for case_stmt in &block.cases {
        let pattern = render_pattern(&case_stmt.pattern);
        lines.push(format!(
            "{}case {}:",
            indent_str(indent_level * indent_width),
            pattern
        ));
        render_block(&case_stmt.body, indent_level + 1, indent_width, lines, context);
    }
}

fn stmt_meta(stmt: &Stmt) -> &NodeMeta {
    match stmt {
        Stmt::If(stmt) => &stmt.meta,
        Stmt::While(stmt) => &stmt.meta,
        Stmt::For(stmt) => &stmt.meta,
        Stmt::Match(stmt) => &stmt.meta,
        Stmt::Assign(stmt) => &stmt.meta,
        Stmt::Expr(stmt) => &stmt.meta,
        Stmt::Pass(stmt) => &stmt.meta,
        Stmt::Empty(stmt) => &stmt.meta,
    }
}

fn render_token_range(tokens: &[Token], range: &TokenRange) -> Option<String> {
    if range.start > range.end || range.end >= tokens.len() {
        return None;
    }
    let mut output = String::new();
    for token in &tokens[range.start..=range.end] {
        output.push_str(&render_token(token));
    }
    Some(output)
}

fn render_token(token: &Token) -> String {
    let mut output = String::new();
    for trivia in &token.leading_trivia {
        output.push_str(&render_trivia(trivia));
    }
    output.push_str(&token.raw);
    for trivia in &token.trailing_trivia {
        output.push_str(&render_trivia(trivia));
    }
    output
}

fn render_trivia(trivia: &Trivia) -> String {
    match &trivia.kind {
        TriviaKind::Comment(text) => format!("#{text}"),
        TriviaKind::RawWhitespace(text) => text.clone(),
        TriviaKind::Blank(_) => "\n".to_string(),
    }
}

fn render_pattern(pattern: &Pattern) -> String {
    match pattern {
        Pattern::Wildcard(_) => "_".to_string(),
        Pattern::Identifier(pattern) => pattern.name.clone(),
        Pattern::Literal(pattern) => render_literal(&pattern.literal),
    }
}

fn render_expr(expr: &Expr, parent_prec: u8) -> String {
    match expr {
        Expr::Identifier(expr) => expr.name.clone(),
        Expr::Literal(expr) => render_literal(&expr.literal),
        Expr::Grouped(expr) => match &*expr.expr {
            Expr::Comprehension(ComprehensionExpr::Generator(_)) => render_expr(&expr.expr, 0),
            _ => format!("({})", render_expr(&expr.expr, 0)),
        },
        Expr::Tuple(expr) => {
            if expr.elements.len() == 1 {
                format!("{},", render_expr(&expr.elements[0], 0))
            } else {
                expr.elements
                    .iter()
                    .map(|item| render_expr(item, 0))
                    .collect::<Vec<_>>()
                    .join(", ")
            }
        }
        Expr::List(expr) => {
            let inner = expr
                .elements
                .iter()
                .map(|item| render_expr(item, 0))
                .collect::<Vec<_>>()
                .join(", ");
            format!("[{inner}]")
        }
        Expr::Dict(expr) => {
            let inner = expr
                .entries
                .iter()
                .map(|entry| format!("{}: {}", render_expr(&entry.key, 0), render_expr(&entry.value, 0)))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{{inner}}}")
        }
        Expr::Set(expr) => {
            let inner = expr
                .elements
                .iter()
                .map(|item| render_expr(item, 0))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{{{inner}}}")
        }
        Expr::Comprehension(expr) => {
            let render_suffix = |fors: &[ComprehensionFor]| {
                let mut suffix = String::new();
                for comp in fors {
                    suffix.push_str(&format!(
                        " for {} in {}",
                        render_expr(&comp.target, 0),
                        render_expr(&comp.iter, 0)
                    ));
                    for condition in &comp.ifs {
                        suffix.push_str(&format!(" if {}", render_expr(condition, 0)));
                    }
                }
                suffix
            };
            match expr {
                ComprehensionExpr::List(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!("[{}{suffix}]", render_expr(&expr.element, 0))
                }
                ComprehensionExpr::Set(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!("{{{}{suffix}}}", render_expr(&expr.element, 0))
                }
                ComprehensionExpr::Generator(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!("({}{suffix})", render_expr(&expr.element, 0))
                }
                ComprehensionExpr::Dict(expr) => {
                    let suffix = render_suffix(&expr.fors);
                    format!(
                        "{{{}: {}{suffix}}}",
                        render_expr(&expr.key, 0),
                        render_expr(&expr.value, 0)
                    )
                }
            }
        }
        Expr::Attribute(expr) => {
            let prec = 9;
            wrap_if_needed(
                format!("{}.{}", render_expr(&expr.value, prec), expr.attr),
                prec,
                parent_prec,
            )
        }
        Expr::Subscript(expr) => {
            let prec = 9;
            wrap_if_needed(
                format!(
                    "{}[{}]",
                    render_expr(&expr.value, prec),
                    render_expr(&expr.index, 0)
                ),
                prec,
                parent_prec,
            )
        }
        Expr::Call(expr) => {
            let prec = 9;
            let callee = render_expr(&expr.callee, prec);
            let args = expr
                .args
                .iter()
                .map(|arg| render_expr(arg, 0))
                .collect::<Vec<_>>()
                .join(", ");
            let rendered = format!("{callee}({args})");
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::Unary(expr) => {
            let prec = 8;
            let value = render_expr(&expr.expr, prec);
            let op = match expr.op {
                UnaryOp::Neg => "-",
                UnaryOp::Not => "not ",
            };
            wrap_if_needed(format!("{op}{value}"), prec, parent_prec)
        }
        Expr::BoolOp(expr) => {
            let prec = boolop_precedence(&expr.op);
            let op = match expr.op {
                BoolOp::And => "and",
                BoolOp::Or => "or",
            };
            let rendered = expr
                .values
                .iter()
                .map(|value| render_expr(value, prec + 1))
                .collect::<Vec<_>>()
                .join(&format!(" {op} "));
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::Compare(expr) => {
            let prec = 4;
            let mut rendered = render_expr(&expr.left, prec + 1);
            for (op, comparator) in expr.ops.iter().zip(expr.comparators.iter()) {
                let op_str = match op {
                    CompareOp::Eq => "==",
                    CompareOp::NotEq => "!=",
                    CompareOp::Lt => "<",
                    CompareOp::LtEq => "<=",
                    CompareOp::Gt => ">",
                    CompareOp::GtEq => ">=",
                    CompareOp::In => "in",
                    CompareOp::NotIn => "not in",
                    CompareOp::Is => "is",
                    CompareOp::IsNot => "is not",
                };
                rendered.push_str(&format!(
                    " {op_str} {}",
                    render_expr(comparator, prec + 1)
                ));
            }
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::IfExpr(expr) => {
            let prec = 1;
            let body = render_expr(&expr.body, prec + 1);
            let condition = render_expr(&expr.condition, prec + 1);
            let else_body = render_expr(&expr.else_body, prec);
            wrap_if_needed(
                format!("{body} if {condition} else {else_body}"),
                prec,
                parent_prec,
            )
        }
        Expr::Lambda(expr) => {
            let prec = 0;
            let params = expr.params.join(", ");
            let body = render_expr(&expr.body, 0);
            let rendered = if params.is_empty() {
                format!("lambda: {body}")
            } else {
                format!("lambda {params}: {body}")
            };
            wrap_if_needed(rendered, prec, parent_prec)
        }
        Expr::Binary(expr) => {
            let prec = binary_precedence(&expr.op);
            let left = render_expr(&expr.left, prec);
            let right = render_expr(&expr.right, prec + 1);
            let op = match expr.op {
                BinaryOp::Add => "+",
                BinaryOp::Sub => "-",
                BinaryOp::Mul => "*",
                BinaryOp::Div => "/",
                BinaryOp::Mod => "%",
            };
            wrap_if_needed(format!("{left} {op} {right}"), prec, parent_prec)
        }
    }
}

fn render_literal(literal: &Literal) -> String {
    match literal {
        Literal::Number(value) => value.raw.clone(),
        Literal::String(value) => value.raw.clone(),
        Literal::Bool(value) => {
            if *value {
                "True".to_string()
            } else {
                "False".to_string()
            }
        }
        Literal::None => "None".to_string(),
    }
}

fn binary_precedence(op: &BinaryOp) -> u8 {
    op.precedence()
}

fn boolop_precedence(op: &BoolOp) -> u8 {
    match op {
        BoolOp::Or => 2,
        BoolOp::And => 3,
    }
}

fn wrap_if_needed(rendered: String, prec: u8, parent_prec: u8) -> String {
    if prec < parent_prec {
        format!("({rendered})")
    } else {
        rendered
    }
}

fn indent_str(count: usize) -> String {
    " ".repeat(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_with(version: PythonVersion, source: &str) -> Result<Program, ParseError> {
        Program::parse(
            source.to_string(),
            ParserConfig {
                features: FeatureSet::from_version(version),
            },
        )
    }

    fn pretty_roundtrip(source: &str) -> Result<Program, ParseError> {
        let program = parse_with(PythonVersion::Py310, source)?;
        let rendered = program.to_python(RenderConfig {
            mode: RenderMode::Pretty,
            reuse_token_ranges: false,
        });
        parse_with(PythonVersion::Py310, &rendered)
    }

    #[test]
    fn lossless_roundtrip() {
        let source = "value = 1\n# comment\nif value:\n    pass\n";
        let program = parse_with(PythonVersion::Py310, source).unwrap();
        let rendered = program.to_python(RenderConfig {
            mode: RenderMode::Lossless,
            reuse_token_ranges: false,
        });
        assert_eq!(rendered, source);
    }

    #[test]
    fn lossless_roundtrip_with_comments() {
        let source = "value = 1  # inline\n\n# leading\nif value:\n    # nested\n    pass\n";
        let program = parse_with(PythonVersion::Py310, source).unwrap();
        let rendered = program.to_python(RenderConfig {
            mode: RenderMode::Lossless,
            reuse_token_ranges: false,
        });
        assert_eq!(rendered, source);
    }

    #[test]
    fn match_version_gate() {
        let source = "match value:\n    case 1:\n        pass\n";
        let result = parse_with(PythonVersion::Py39, source);
        assert!(result.is_err());
    }

    #[test]
    fn pretty_roundtrip_match() {
        let source = "match value:\n    case 1:\n        pass\n";
        let program = pretty_roundtrip(source).unwrap();
        assert!(!program.body.is_empty());
    }

    #[test]
    fn error_span_reported() {
        let source = "if :\n    pass\n";
        let result = parse_with(PythonVersion::Py310, source);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.span.start.line >= 1);
    }

    #[test]
    fn comprehension_roundtrip_pretty() {
        let source = "values = [x for x in items if x > 1]\n";
        let program = pretty_roundtrip(source).unwrap();
        assert!(!program.body.is_empty());
    }

    #[test]
    fn dict_set_generator_roundtrip() {
        let source = "data = {k: v for k in items}\nset_values = {x for x in items}\ngen = (x for x in items)\n";
        let program = pretty_roundtrip(source).unwrap();
        assert_eq!(program.body.len(), 3);
    }

    #[test]
    fn ifexpr_lambda_roundtrip() {
        let source = "value = (lambda x: x + 1)(1 if flag else 2)\n";
        let program = pretty_roundtrip(source).unwrap();
        assert!(!program.body.is_empty());
    }

    fn expr_eq(left: &Expr, right: &Expr) -> bool {
        match (left, right) {
            (Expr::Grouped(left), _) => expr_eq(&left.expr, right),
            (_, Expr::Grouped(right)) => expr_eq(left, &right.expr),
            (Expr::Identifier(left), Expr::Identifier(right)) => left.name == right.name,
            (Expr::Literal(left), Expr::Literal(right)) => literal_eq(&left.literal, &right.literal),
            (Expr::Binary(left), Expr::Binary(right)) => {
                left.op == right.op
                    && expr_eq(&left.left, &right.left)
                    && expr_eq(&left.right, &right.right)
            }
            (Expr::Unary(left), Expr::Unary(right)) => {
                left.op == right.op && expr_eq(&left.expr, &right.expr)
            }
            (Expr::BoolOp(left), Expr::BoolOp(right)) => {
                left.op == right.op && expr_vec_eq(&left.values, &right.values)
            }
            (Expr::Compare(left), Expr::Compare(right)) => {
                left.ops == right.ops
                    && expr_eq(&left.left, &right.left)
                    && expr_vec_eq(&left.comparators, &right.comparators)
            }
            (Expr::Lambda(left), Expr::Lambda(right)) => {
                left.params == right.params && expr_eq(&left.body, &right.body)
            }
            (Expr::IfExpr(left), Expr::IfExpr(right)) => {
                expr_eq(&left.body, &right.body)
                    && expr_eq(&left.condition, &right.condition)
                    && expr_eq(&left.else_body, &right.else_body)
            }
            (Expr::Call(left), Expr::Call(right)) => {
                expr_eq(&left.callee, &right.callee) && expr_vec_eq(&left.args, &right.args)
            }
            (Expr::Tuple(left), Expr::Tuple(right)) => expr_vec_eq(&left.elements, &right.elements),
            (Expr::List(left), Expr::List(right)) => expr_vec_eq(&left.elements, &right.elements),
            (Expr::Set(left), Expr::Set(right)) => expr_vec_eq(&left.elements, &right.elements),
            (Expr::Dict(left), Expr::Dict(right)) => dict_entry_vec_eq(&left.entries, &right.entries),
            (Expr::Attribute(left), Expr::Attribute(right)) => {
                left.attr == right.attr && expr_eq(&left.value, &right.value)
            }
            (Expr::Subscript(left), Expr::Subscript(right)) => {
                expr_eq(&left.value, &right.value) && expr_eq(&left.index, &right.index)
            }
            (Expr::Comprehension(left), Expr::Comprehension(right)) => comp_eq(left, right),
            _ => false,
        }
    }

    fn expr_vec_eq(left: &[Expr], right: &[Expr]) -> bool {
        left.len() == right.len() && left.iter().zip(right.iter()).all(|(a, b)| expr_eq(a, b))
    }

    fn dict_entry_vec_eq(left: &[DictEntry], right: &[DictEntry]) -> bool {
        left.len() == right.len()
            && left
                .iter()
                .zip(right.iter())
                .all(|(a, b)| expr_eq(&a.key, &b.key) && expr_eq(&a.value, &b.value))
    }

    fn literal_eq(left: &Literal, right: &Literal) -> bool {
        match (left, right) {
            (Literal::Number(left), Literal::Number(right)) => left == right,
            (Literal::String(left), Literal::String(right)) => left == right,
            (Literal::Bool(left), Literal::Bool(right)) => left == right,
            (Literal::None, Literal::None) => true,
            _ => false,
        }
    }

    fn comp_eq(left: &ComprehensionExpr, right: &ComprehensionExpr) -> bool {
        match (left, right) {
            (ComprehensionExpr::List(left), ComprehensionExpr::List(right)) => {
                expr_eq(&left.element, &right.element)
                    && comp_fors_eq(&left.fors, &right.fors)
            }
            (ComprehensionExpr::Set(left), ComprehensionExpr::Set(right)) => {
                expr_eq(&left.element, &right.element)
                    && comp_fors_eq(&left.fors, &right.fors)
            }
            (ComprehensionExpr::Generator(left), ComprehensionExpr::Generator(right)) => {
                expr_eq(&left.element, &right.element)
                    && comp_fors_eq(&left.fors, &right.fors)
            }
            (ComprehensionExpr::Dict(left), ComprehensionExpr::Dict(right)) => {
                expr_eq(&left.key, &right.key)
                    && expr_eq(&left.value, &right.value)
                    && comp_fors_eq(&left.fors, &right.fors)
            }
            _ => false,
        }
    }

    fn comp_fors_eq(left: &[ComprehensionFor], right: &[ComprehensionFor]) -> bool {
        left.len() == right.len()
            && left.iter().zip(right.iter()).all(|(a, b)| {
                expr_eq(&a.target, &b.target)
                    && expr_eq(&a.iter, &b.iter)
                    && expr_vec_eq(&a.ifs, &b.ifs)
            })
    }

    #[test]
    fn property_expr_roundtrip() {
        for seed in 1..20 {
            let expr = generate_expr(seed, 3);
            let expected = expr.clone();
            let stmt = Stmt::Expr(ExprStmt {
                meta: NodeMeta::default(),
                expr,
            });
            let program = Program {
                meta: NodeMeta::default(),
                indent_width: 4,
                body: vec![stmt],
                tokens: Vec::new(),
                raw_tokens: Vec::new(),
                dirty: true,
            };
            let rendered = program.to_python(RenderConfig {
                mode: RenderMode::Pretty,
                reuse_token_ranges: false,
            });
            let parsed = parse_with(PythonVersion::Py310, &rendered).unwrap();
            let parsed_expr = match &parsed.body[0] {
                Stmt::Expr(stmt) => &stmt.expr,
                _ => panic!("expected expression statement"),
            };
            assert!(expr_eq(&expected, parsed_expr));
        }
    }

    fn generate_expr(seed: u64, depth: u8) -> Expr {
        let mut value = seed;
        let mut next = || {
            value = value.wrapping_mul(1664525).wrapping_add(1013904223);
            value
        };
        if depth == 0 {
            return Expr::Literal(LiteralExpr {
                meta: NodeMeta::default(),
                literal: Literal::Number(NumberLiteral {
                    raw: (next() % 10).to_string(),
                }),
            });
        }
        match next() % 4 {
            0 => Expr::Identifier(IdentifierExpr {
                meta: NodeMeta::default(),
                name: format!("v{}", next() % 5),
            }),
            1 => Expr::Unary(UnaryExpr {
                meta: NodeMeta::default(),
                op: UnaryOp::Neg,
                expr: Box::new(generate_expr(next(), depth - 1)),
            }),
            2 => Expr::Binary(BinaryExpr {
                meta: NodeMeta::default(),
                left: Box::new(generate_expr(next(), depth - 1)),
                op: if next() % 2 == 0 {
                    BinaryOp::Add
                } else {
                    BinaryOp::Mul
                },
                right: Box::new(generate_expr(next(), depth - 1)),
            }),
            _ => Expr::Call(CallExpr {
                meta: NodeMeta::default(),
                callee: Box::new(Expr::Identifier(IdentifierExpr {
                    meta: NodeMeta::default(),
                    name: "fn".to_string(),
                })),
                args: vec![generate_expr(next(), depth - 1)],
            }),
        }
    }
}
