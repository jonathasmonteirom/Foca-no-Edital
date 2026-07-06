import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_community.document_loaders import PyPDFLoader

load_dotenv()

app = Flask(__name__)

CAMINHO_UPLOADS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

@app.route('/', methods=['GET'])
def home():
    return jsonify({"mensagem": "API Flask com RAG está funcionando."})

@app.route('/chat', methods=['POST'])
def chat():
    dados = request.get_json()
    query = dados.get('pergunta')
    nome_arquivo_pdf = dados.get('arquivo_pdf')

    if not query or not nome_arquivo_pdf:
        return jsonify({"erro": "Pergunta ou arquivo faltando."}), 400

    nome_puro = os.path.basename(nome_arquivo_pdf)
    
    caminho_pdf = f"/app/uploads/{nome_puro}"

    if not os.path.exists(caminho_pdf):
        return jsonify({"erro": f"PDF não encontrado no caminho: {caminho_pdf}"}), 404

    try:
        loader = PyPDFLoader(caminho_pdf)
        documentos = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        texts = text_splitter.split_documents(documentos)

        embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
        
        vector_store = Chroma.from_documents(
            documents=texts, 
            embedding=embeddings
        )
        retriever = vector_store.as_retriever()

        llm = ChatOpenAI(model="gpt-4o-mini")
        
        prompt_template = """Use the context provided to answer 
        the user's question below. If you do not know the answer 
        based on the context provided, tell the user that you do 
        not know the answer to their question based on the context
        provided and that you are sorry.

        context: {context}

        question: {query}

        answer: """
        
        custom_rag_prompt = PromptTemplate.from_template(prompt_template)

        rag_chain = (
            {"context": retriever | format_docs, "query": RunnablePassthrough()}
            | custom_rag_prompt
            | llm
            | StrOutputParser()
        )

        resposta = rag_chain.invoke(query)
        return jsonify({"resposta": resposta})

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)