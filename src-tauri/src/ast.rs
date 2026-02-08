use serde::{Deserialize, Serialize};
use std::fmt;

mod lexer;
mod parser;
mod render;

#[cfg(test)]
mod tests;

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
    FunctionDef(FunctionDefStmt),
    Assign(AssignStmt),
    AugAssign(AugAssignStmt),
    Expr(ExprStmt),
    Pass(PassStmt),
    Return(ReturnStmt),
    Break(BreakStmt),
    Continue(ContinueStmt),
    Empty(EmptyStmt),
    Import(ImportStmt),
    Try(TryStmt),
    ClassDef(ClassDefStmt),
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
pub struct FunctionDefStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub name: String,
    pub params: Vec<String>,
    pub body: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassDefStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub name: String,
    pub bases: Vec<Expr>,
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
pub struct AugAssignStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: Expr,
    pub op: Operator,
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
pub struct ReturnStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub value: Option<Expr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakStmt {
    #[serde(default)]
    pub meta: NodeMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinueStmt {
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
pub struct ImportStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub module: String,
    pub names: Vec<ImportName>,
    pub is_from: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportName {
    pub name: String,
    pub alias: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TryStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub body: Block,
    pub handlers: Vec<ExceptHandler>,
    pub finally_body: Option<Block>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExceptHandler {
    #[serde(default)]
    pub meta: NodeMeta,
    pub exception_type: Option<Expr>,
    pub name: Option<String>,
    pub body: Block,
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
    Slice(SliceExpr),
    Grouped(GroupedExpr),
    List(ListExpr),
    Dict(DictExpr),
    Set(SetExpr),
    Comprehension(ComprehensionExpr),
    FString(FStringExpr),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FStringExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub parts: Vec<FStringPart>,
    pub quote: QuoteStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum FStringPart {
    Literal(String),
    Expr(Expr),
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
pub struct KeywordArg {
    pub name: String,
    pub value: Expr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub callee: Box<Expr>,
    pub args: Vec<Expr>,
    #[serde(default)]
    pub kwargs: Vec<KeywordArg>,
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
pub struct SliceExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub lower: Option<Box<Expr>>,
    pub upper: Option<Box<Expr>>,
    pub step: Option<Box<Expr>>,
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
    FloorDiv,
    Power,
}

impl BinaryOp {
    fn precedence(&self) -> u8 {
        match self {
            BinaryOp::Add | BinaryOp::Sub => 5,
            BinaryOp::Mul | BinaryOp::Div | BinaryOp::Mod | BinaryOp::FloorDiv => 6,
            BinaryOp::Power => 7,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FStringLiteral {
    pub parts: Vec<FStringTokenPart>,
    pub quote: QuoteStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", content = "data")]
pub enum FStringTokenPart {
    Literal(String),
    ExprText(String),
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
    FunctionDef(IrFunctionDefStmt),
    Assign(IrAssignStmt),
    AugAssign(IrAugAssignStmt),
    Expr(IrExprStmt),
    Pass(IrPassStmt),
    Return(IrReturnStmt),
    Break(IrBreakStmt),
    Continue(IrContinueStmt),
    Empty(IrEmptyStmt),
    Import(IrImportStmt),
    Try(IrTryStmt),
    ClassDef(IrClassDefStmt),
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
pub struct IrFunctionDefStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub name: String,
    pub params: Vec<String>,
    pub body: IrBlock,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrClassDefStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub name: String,
    pub bases: Vec<IrExpr>,
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
pub struct IrAugAssignStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub target: IrExpr,
    pub op: Operator,
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
pub struct IrReturnStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub value: Option<IrExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrBreakStmt {
    #[serde(default)]
    pub meta: NodeMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrContinueStmt {
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
pub struct IrImportStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub module: String,
    pub names: Vec<ImportName>,
    pub is_from: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrTryStmt {
    #[serde(default)]
    pub meta: NodeMeta,
    pub body: IrBlock,
    pub handlers: Vec<IrExceptHandler>,
    pub finally_body: Option<IrBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrExceptHandler {
    #[serde(default)]
    pub meta: NodeMeta,
    pub exception_type: Option<IrExpr>,
    pub name: Option<String>,
    pub body: IrBlock,
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
    Slice(IrSliceExpr),
    Grouped(IrGroupedExpr),
    List(IrListExpr),
    Dict(IrDictExpr),
    Set(IrSetExpr),
    Comprehension(IrComprehensionExpr),
    FString(IrFStringExpr),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrFStringExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub parts: Vec<IrFStringPart>,
    pub quote: QuoteStyle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum IrFStringPart {
    Literal(String),
    Expr(IrExpr),
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
pub struct IrKeywordArg {
    pub name: String,
    pub value: IrExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IrCallExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub callee: Box<IrExpr>,
    pub args: Vec<IrExpr>,
    #[serde(default)]
    pub kwargs: Vec<IrKeywordArg>,
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
pub struct IrSliceExpr {
    #[serde(default)]
    pub meta: NodeMeta,
    pub lower: Option<Box<IrExpr>>,
    pub upper: Option<Box<IrExpr>>,
    pub step: Option<Box<IrExpr>>,
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
    FString(FStringLiteral),
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
    Def,
    Match,
    Case,
    Pass,
    Return,
    Break,
    Continue,
    And,
    Or,
    Not,
    True,
    False,
    None,
    Import,
    From,
    As,
    Try,
    Except,
    Finally,
    Class,
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
    PlusAssign,
    MinusAssign,
    StarAssign,
    SlashAssign,
    PercentAssign,
    FloorDiv,
    Power,
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
    FString,
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
            TokenKind::FString(_) => TokenTag::FString,
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
        IrStmt::FunctionDef(stmt) => block_has_match(&stmt.body),
        IrStmt::ClassDef(stmt) => block_has_match(&stmt.body),
        IrStmt::Try(stmt) => {
            block_has_match(&stmt.body)
                || stmt.handlers.iter().any(|h| block_has_match(&h.body))
                || stmt
                    .finally_body
                    .as_ref()
                    .map(block_has_match)
                    .unwrap_or(false)
        }
        IrStmt::Assign(_) | IrStmt::AugAssign(_) | IrStmt::Expr(_) | IrStmt::Pass(_) | IrStmt::Return(_) | IrStmt::Break(_) | IrStmt::Continue(_) | IrStmt::Empty(_) | IrStmt::Import(_) => false,
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
        Stmt::FunctionDef(stmt) => IrStmt::FunctionDef(IrFunctionDefStmt {
            meta: stmt.meta.clone(),
            name: stmt.name.clone(),
            params: stmt.params.clone(),
            body: block_to_ir(&stmt.body),
        }),
        Stmt::ClassDef(stmt) => IrStmt::ClassDef(IrClassDefStmt {
            meta: stmt.meta.clone(),
            name: stmt.name.clone(),
            bases: stmt.bases.iter().map(expr_to_ir).collect(),
            body: block_to_ir(&stmt.body),
        }),
        Stmt::Assign(stmt) => IrStmt::Assign(IrAssignStmt {
            meta: stmt.meta.clone(),
            target: expr_to_ir(&stmt.target),
            value: expr_to_ir(&stmt.value),
        }),
        Stmt::AugAssign(stmt) => IrStmt::AugAssign(IrAugAssignStmt {
            meta: stmt.meta.clone(),
            target: expr_to_ir(&stmt.target),
            op: stmt.op,
            value: expr_to_ir(&stmt.value),
        }),
        Stmt::Expr(stmt) => IrStmt::Expr(IrExprStmt {
            meta: stmt.meta.clone(),
            expr: expr_to_ir(&stmt.expr),
        }),
        Stmt::Pass(stmt) => IrStmt::Pass(IrPassStmt {
            meta: stmt.meta.clone(),
        }),
        Stmt::Return(stmt) => IrStmt::Return(IrReturnStmt {
            meta: stmt.meta.clone(),
            value: stmt.value.as_ref().map(expr_to_ir),
        }),
        Stmt::Break(stmt) => IrStmt::Break(IrBreakStmt {
            meta: stmt.meta.clone(),
        }),
        Stmt::Continue(stmt) => IrStmt::Continue(IrContinueStmt {
            meta: stmt.meta.clone(),
        }),
        Stmt::Empty(stmt) => IrStmt::Empty(IrEmptyStmt {
            meta: stmt.meta.clone(),
            source: stmt.source.clone(),
        }),
        Stmt::Import(stmt) => IrStmt::Import(IrImportStmt {
            meta: stmt.meta.clone(),
            module: stmt.module.clone(),
            names: stmt.names.clone(),
            is_from: stmt.is_from,
        }),
        Stmt::Try(stmt) => IrStmt::Try(IrTryStmt {
            meta: stmt.meta.clone(),
            body: block_to_ir(&stmt.body),
            handlers: stmt
                .handlers
                .iter()
                .map(|h| IrExceptHandler {
                    meta: h.meta.clone(),
                    exception_type: h.exception_type.as_ref().map(expr_to_ir),
                    name: h.name.clone(),
                    body: block_to_ir(&h.body),
                })
                .collect(),
            finally_body: stmt.finally_body.as_ref().map(block_to_ir),
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
        IrStmt::FunctionDef(stmt) => Stmt::FunctionDef(FunctionDefStmt {
            meta: stmt.meta.clone(),
            name: stmt.name.clone(),
            params: stmt.params.clone(),
            body: block_from_ir_with_indent(&stmt.body, indent_level + 1),
        }),
        IrStmt::ClassDef(stmt) => Stmt::ClassDef(ClassDefStmt {
            meta: stmt.meta.clone(),
            name: stmt.name.clone(),
            bases: stmt.bases.iter().map(expr_from_ir).collect(),
            body: block_from_ir_with_indent(&stmt.body, indent_level + 1),
        }),
        IrStmt::Assign(stmt) => Stmt::Assign(AssignStmt {
            meta: stmt.meta.clone(),
            target: expr_from_ir(&stmt.target),
            value: expr_from_ir(&stmt.value),
        }),
        IrStmt::AugAssign(stmt) => Stmt::AugAssign(AugAssignStmt {
            meta: stmt.meta.clone(),
            target: expr_from_ir(&stmt.target),
            op: stmt.op,
            value: expr_from_ir(&stmt.value),
        }),
        IrStmt::Expr(stmt) => Stmt::Expr(ExprStmt {
            meta: stmt.meta.clone(),
            expr: expr_from_ir(&stmt.expr),
        }),
        IrStmt::Pass(stmt) => Stmt::Pass(PassStmt {
            meta: stmt.meta.clone(),
        }),
        IrStmt::Return(stmt) => Stmt::Return(ReturnStmt {
            meta: stmt.meta.clone(),
            value: stmt.value.as_ref().map(expr_from_ir),
        }),
        IrStmt::Break(stmt) => Stmt::Break(BreakStmt {
            meta: stmt.meta.clone(),
        }),
        IrStmt::Continue(stmt) => Stmt::Continue(ContinueStmt {
            meta: stmt.meta.clone(),
        }),
        IrStmt::Empty(stmt) => Stmt::Empty(EmptyStmt {
            meta: stmt.meta.clone(),
            source: stmt.source.clone(),
        }),
        IrStmt::Import(stmt) => Stmt::Import(ImportStmt {
            meta: stmt.meta.clone(),
            module: stmt.module.clone(),
            names: stmt.names.clone(),
            is_from: stmt.is_from,
        }),
        IrStmt::Try(stmt) => Stmt::Try(TryStmt {
            meta: stmt.meta.clone(),
            body: block_from_ir_with_indent(&stmt.body, indent_level + 1),
            handlers: stmt
                .handlers
                .iter()
                .map(|h| ExceptHandler {
                    meta: h.meta.clone(),
                    exception_type: h.exception_type.as_ref().map(expr_from_ir),
                    name: h.name.clone(),
                    body: block_from_ir_with_indent(&h.body, indent_level + 1),
                })
                .collect(),
            finally_body: stmt
                .finally_body
                .as_ref()
                .map(|block| block_from_ir_with_indent(block, indent_level + 1)),
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
            kwargs: expr.kwargs.iter().map(|kw| IrKeywordArg {
                name: kw.name.clone(),
                value: expr_to_ir(&kw.value),
            }).collect(),
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
        Expr::Slice(expr) => IrExpr::Slice(IrSliceExpr {
            meta: expr.meta.clone(),
            lower: expr.lower.as_ref().map(|e| Box::new(expr_to_ir(e))),
            upper: expr.upper.as_ref().map(|e| Box::new(expr_to_ir(e))),
            step: expr.step.as_ref().map(|e| Box::new(expr_to_ir(e))),
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
        Expr::FString(expr) => IrExpr::FString(IrFStringExpr {
            meta: expr.meta.clone(),
            parts: expr.parts.iter().map(|p| match p {
                FStringPart::Literal(s) => IrFStringPart::Literal(s.clone()),
                FStringPart::Expr(e) => IrFStringPart::Expr(expr_to_ir(e)),
            }).collect(),
            quote: expr.quote.clone(),
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
            kwargs: expr.kwargs.iter().map(|kw| KeywordArg {
                name: kw.name.clone(),
                value: expr_from_ir(&kw.value),
            }).collect(),
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
        IrExpr::Slice(expr) => Expr::Slice(SliceExpr {
            meta: expr.meta.clone(),
            lower: expr.lower.as_ref().map(|e| Box::new(expr_from_ir(e))),
            upper: expr.upper.as_ref().map(|e| Box::new(expr_from_ir(e))),
            step: expr.step.as_ref().map(|e| Box::new(expr_from_ir(e))),
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
        IrExpr::FString(expr) => Expr::FString(FStringExpr {
            meta: expr.meta.clone(),
            parts: expr.parts.iter().map(|p| match p {
                IrFStringPart::Literal(s) => FStringPart::Literal(s.clone()),
                IrFStringPart::Expr(e) => FStringPart::Expr(expr_from_ir(e)),
            }).collect(),
            quote: expr.quote.clone(),
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
