#!/usr/bin/env python3
"""
Qwen3-ASR Transkription (optional): wandelt Ausgabe in das gleiche Dict-Format wie Whisper
für die bestehende UltraStar-Pipeline.

Siehe: https://github.com/QwenLM/Qwen3-ASR
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Cache nach (Modell-Backend-Parameter), um Laden zu vermeiden
_qwen_model_cache: Dict[str, Any] = {"key": None, "model": None}

_WHISPER_CODE_TO_QWEN: Dict[str, str] = {
    "ar": "Arabic",
    "cs": "Czech",
    "da": "Danish",
    "de": "German",
    "el": "Greek",
    "en": "English",
    "es": "Spanish",
    "fa": "Persian",
    "fil": "Filipino",
    "fi": "Finnish",
    "fr": "French",
    "hi": "Hindi",
    "hu": "Hungarian",
    "id": "Indonesian",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "mk": "Macedonian",
    "ms": "Malay",
    "nl": "Dutch",
    "pl": "Polish",
    "pt": "Portuguese",
    "ro": "Romanian",
    "ru": "Russian",
    "sv": "Swedish",
    "th": "Thai",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "yue": "Cantonese",
    "zh": "Chinese",
}


def coerce_qwen_language(language: Any) -> Optional[str]:
    """Whisper-Kurzcodes ('de') → Qwen-Sprachnamen ('German'); None = automatisch."""
    if language is None or language == "":
        return None
    s = str(language).strip()
    if not s:
        return None
    short = s.lower().replace("_", "-").split("-")[0]
    if short in _WHISPER_CODE_TO_QWEN:
        return _WHISPER_CODE_TO_QWEN[short]
    return s


def _cache_key_from_cfg(cfg: Dict[str, Any]) -> str:
    """Stabiler Schlüssel für Modell-Cache (nur relevante Felder)."""
    subset = {
        "qwen3_asr_model": cfg.get("qwen3_asr_model", "Qwen/Qwen3-ASR-1.7B"),
        "qwen3_forced_aligner": cfg.get("qwen3_forced_aligner", "Qwen/Qwen3-ForcedAligner-0.6B"),
        "qwen3_backend": (cfg.get("qwen3_backend") or "transformers").lower(),
        "qwen3_dtype": (cfg.get("qwen3_dtype") or "bfloat16").lower(),
        "qwen3_device_map": cfg.get("qwen3_device_map"),
        "qwen3_max_new_tokens": cfg.get("qwen3_max_new_tokens"),
        "qwen3_max_inference_batch_size": cfg.get("qwen3_max_inference_batch_size"),
        "qwen3_gpu_memory_utilization": cfg.get("qwen3_gpu_memory_utilization"),
        "qwen3_vllm": cfg.get("qwen3_vllm"),
        "qwen3_transformers": cfg.get("qwen3_transformers"),
    }
    return json.dumps(subset, sort_keys=True, default=str)


def _get_torch_dtype(name: str):
    import torch

    n = (name or "bfloat16").lower()
    if n in ("bf16", "bfloat16"):
        return torch.bfloat16
    if n in ("fp16", "float16", "half"):
        return torch.float16
    return torch.float32


def _load_qwen_model(cfg: Dict[str, Any]):
    import torch
    from qwen_asr import Qwen3ASRModel

    backend = (cfg.get("qwen3_backend") or "transformers").lower()
    model_id = cfg.get("qwen3_asr_model", "Qwen/Qwen3-ASR-1.7B")
    aligner_id = cfg.get("qwen3_forced_aligner", "Qwen/Qwen3-ForcedAligner-0.6B")
    dtype = _get_torch_dtype(str(cfg.get("qwen3_dtype") or "bfloat16"))

    device_map = cfg.get("qwen3_device_map")
    if not device_map:
        device_map = "cuda:0" if torch.cuda.is_available() else "cpu"

    aligner_kw: Dict[str, Any] = {"dtype": dtype, "device_map": device_map}
    extra_align = cfg.get("qwen3_forced_aligner_kwargs")
    if isinstance(extra_align, dict):
        aligner_kw.update(extra_align)

    max_new = int(cfg.get("qwen3_max_new_tokens", 2048))
    max_batch = int(cfg.get("qwen3_max_inference_batch_size", 8))

    if backend == "vllm":
        vllm_kw: Dict[str, Any] = {}
        if cfg.get("qwen3_gpu_memory_utilization") is not None:
            vllm_kw["gpu_memory_utilization"] = float(cfg["qwen3_gpu_memory_utilization"])
        ex_v = cfg.get("qwen3_vllm")
        if isinstance(ex_v, dict):
            vllm_kw.update(ex_v)
        logger.info(
            "Lade Qwen3-ASR (vLLM): asr=%s aligner=%s", model_id, aligner_id
        )
        return Qwen3ASRModel.LLM(
            model=model_id,
            forced_aligner=aligner_id,
            forced_aligner_kwargs=aligner_kw,
            max_inference_batch_size=max_batch,
            max_new_tokens=max_new,
            **vllm_kw,
        )

    tf_kw: Dict[str, Any] = {"dtype": dtype, "device_map": device_map}
    ex_t = cfg.get("qwen3_transformers")
    if isinstance(ex_t, dict):
        tf_kw.update(ex_t)
    logger.info(
        "Lade Qwen3-ASR (transformers): asr=%s aligner=%s device=%s",
        model_id,
        aligner_id,
        device_map,
    )
    return Qwen3ASRModel.from_pretrained(
        model_id,
        forced_aligner=aligner_id,
        forced_aligner_kwargs=aligner_kw,
        max_inference_batch_size=max_batch,
        max_new_tokens=max_new,
        **tf_kw,
    )


def get_cached_qwen_model(cfg: Dict[str, Any]):
    global _qwen_model_cache
    key = _cache_key_from_cfg(cfg)
    if _qwen_model_cache["key"] == key and _qwen_model_cache["model"] is not None:
        return _qwen_model_cache["model"]
    model = _load_qwen_model(cfg)
    _qwen_model_cache = {"key": key, "model": model}
    return model


def repair_qwen_flat_word_timestamps(segments: List[Dict[str, Any]]) -> None:
    """
    Qwen Forced Aligner liefert oft lange Passagen mit start≈end oder identischen Buckets.
    Verteilt die Segment-Zeitspanne gewichtet nach Tokenlänge (näher an natürlichem Gesangstempo).
    """
    min_dur = 0.028
    eps_flat = 0.022

    for seg in segments:
        words = seg.get("words")
        if not words or len(words) < 2:
            continue
        n = len(words)
        flat_n = sum(
            1 for w in words if float(w["end"]) - float(w["start"]) < eps_flat
        )
        flat_ratio = flat_n / n

        t0 = float(words[0]["start"])
        t1 = float(words[-1]["end"])
        if t1 <= t0 + 0.05:
            t1 = t0 + max(n * min_dur, 4.0)
        span = t1 - t0

        if flat_ratio >= 0.10:
            weights = [max(1, len((w.get("word") or "").strip())) for w in words]
            tw = sum(weights)
            if tw <= 0:
                continue
            durs = [max(min_dur, span * (wt / tw)) for wt in weights]
            ssum = sum(durs)
            if ssum <= 0:
                continue
            scale = span / ssum
            durs = [d * scale for d in durs]
            acc = t0
            for w, d in zip(words, durs):
                w["start"] = round(acc, 3)
                acc += d
                w["end"] = round(acc, 3)
            seg["start"] = float(words[0]["start"])
            seg["end"] = float(words[-1]["end"])
            logger.info(
                "Qwen timing repair: %.0f%% flat tokens → char-weighted spread over %.2fs (%d words)",
                100 * flat_ratio,
                span,
                n,
            )
        else:
            prev_end = float(words[0]["start"])
            for w in words:
                s = max(float(w["start"]), prev_end)
                e = max(float(w["end"]), s + min_dur)
                w["start"] = round(s, 3)
                w["end"] = round(e, 3)
                prev_end = float(w["end"])
            seg["start"] = float(words[0]["start"])
            seg["end"] = float(words[-1]["end"])


def asr_transcription_to_whisper_dict(r: Any) -> Dict[str, Any]:
    """Eine ASRTranscription → whisper-ähnliches Ergebnis für convert_to_ultrastar."""
    lang = (getattr(r, "language", None) or "").strip() or "unknown"
    text = (getattr(r, "text", None) or "").strip()
    words: List[Dict[str, Any]] = []
    ts = getattr(r, "time_stamps", None)
    if ts is not None:
        items = getattr(ts, "items", None) or []
        for it in items:
            wtxt = (getattr(it, "text", None) or "").strip()
            if not wtxt:
                continue
            words.append(
                {
                    "word": wtxt,
                    "start": float(getattr(it, "start_time", 0)),
                    "end": float(getattr(it, "end_time", 0)),
                }
            )

    segments: List[Dict[str, Any]] = []
    if words:
        chunk_text_parts: List[str] = [w["word"] for w in words]
        if any(" " in p for p in chunk_text_parts):
            joined = " ".join(chunk_text_parts)
        else:
            joined = "".join(chunk_text_parts)
        segments.append(
            {
                "id": 0,
                "seek": 0,
                "start": words[0]["start"],
                "end": words[-1]["end"],
                "text": text or joined,
                "words": words,
            }
        )
        repair_qwen_flat_word_timestamps(segments)
    elif text:
        segments.append(
            {
                "id": 0,
                "seek": 0,
                "start": 0.0,
                "end": 0.01,
                "text": text,
                "words": [],
            }
        )

    out = {"text": text or " ".join(w["word"] for w in words), "language": lang, "segments": segments}
    n_w = len(words)
    if text and n_w == 0:
        logger.warning(
            "Qwen3-ASR: Transkript hat Text (%d Zeichen), aber keine Forced-Aligner-Tokens — "
            "UltraStar nutzt dann nur Segment-Text ohne Wortzeiten.",
            len(text),
        )
    else:
        logger.info("Qwen3-ASR: %d aligned word tokens, %d segment(s)", n_w, len(segments))
    return out


def transcribe_audio_file_qwen3(audio_path: str, cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Transkribiert eine Datei mit Qwen3-ASR + Forced Aligner (Wortzeiten).

    Returns:
        Gleiche Struktur wie faster-whisper/openai-whisper (text, language, segments/words).
    """
    try:
        model = get_cached_qwen_model(cfg)
    except ImportError as e:
        logger.error(
            "qwen-asr nicht installiert. Siehe https://github.com/QwenLM/Qwen3-ASR — pip install qwen-asr"
        )
        raise RuntimeError(
            "qwen-asr fehlt — Installation: pip install qwen-asr  (vLLM: pip install 'qwen-asr[vllm]')"
        ) from e

    lang = coerce_qwen_language(cfg.get("language"))

    logger.info("Transkribiere (Qwen3-ASR): %s", audio_path[:120])
    results = model.transcribe(
        audio=audio_path,
        language=lang,
        return_time_stamps=True,
    )
    if not results:
        return None
    out = asr_transcription_to_whisper_dict(results[0])
    logger.info("Qwen3-ASR fertig: Sprache=%s, Länge Text=%d", out.get("language"), len(out.get("text") or ""))
    return out


def default_qwen_env_overrides() -> Dict[str, Any]:
    """Umgebungsvariablen (optional) lesen."""
    o: Dict[str, Any] = {}
    m = os.environ.get("QWEN3_ASR_MODEL")
    if m:
        o["qwen3_asr_model"] = m
    a = os.environ.get("QWEN3_FORCED_ALIGNER")
    if a:
        o["qwen3_forced_aligner"] = a
    b = os.environ.get("QWEN3_BACKEND")
    if b:
        o["qwen3_backend"] = b.strip().lower()
    return o
