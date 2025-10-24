#!/usr/bin/env python3
"""
Processing Queue Manager für AI-Services
Verwaltet eine Queue für die sequenzielle Verarbeitung von Songs
"""

import threading
import time
import logging
from typing import Dict, Any, Optional, Callable
from queue import Queue, Empty
import json

logger = logging.getLogger(__name__)

class ProcessingQueue:
    """Queue-Manager für die sequenzielle Verarbeitung von Songs"""
    
    def __init__(self):
        self.queue = Queue()
        self.is_processing = False
        self.current_job = None
        self.status_callback = None
        self.queue_callback = None
        self.worker_thread = None
        self._stop_event = threading.Event()
        self.total_jobs_added = 0  # Verfolge die Gesamtanzahl der hinzugefügten Jobs
        
        # Starte Worker-Thread
        self._start_worker()
    
    def _start_worker(self):
        """Startet den Worker-Thread für die Queue-Verarbeitung"""
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.worker_thread.start()
            logger.info("🔄 Processing Queue Worker gestartet")
    
    def _worker_loop(self):
        """Hauptschleife des Worker-Threads"""
        while not self._stop_event.is_set():
            try:
                # Warte auf Job mit Timeout
                try:
                    job = self.queue.get(timeout=1.0)
                except Empty:
                    continue
                
                if job is None:  # Shutdown-Signal
                    break
                
                self._process_job(job)
                self.queue.task_done()
                
            except Exception as e:
                logger.error(f"❌ Fehler im Worker-Thread: {e}")
                time.sleep(1)
    
    def _process_job(self, job: Dict[str, Any]):
        """Verarbeitet einen einzelnen Job"""
        try:
            self.current_job = job
            self.is_processing = True
            
            logger.info(f"🚀 Starte Verarbeitung für Job: {job.get('id', 'unknown')}")
            
            # Sende Status-Update
            if self.status_callback:
                self.status_callback(job, 'downloading')
            
            # Sende Queue-Status-Update
            if self.queue_callback:
                self.queue_callback(self.get_status())
            
            # Führe die Verarbeitung aus
            from routes.processing.modular_process import run_modular_pipeline
            run_modular_pipeline(job)
            
            logger.info(f"✅ Job erfolgreich abgeschlossen: {job.get('id', 'unknown')}")
            
            # Sende finalen Status
            if self.status_callback:
                self.status_callback(job, 'finished')
                
        except Exception as e:
            logger.error(f"❌ Job fehlgeschlagen: {job.get('id', 'unknown')} - {e}")
            
            # Sende Fehlerstatus
            if self.status_callback:
                self.status_callback(job, 'failed')
                
        finally:
            self.current_job = None
            self.is_processing = False
            
            # Sende Queue-Status-Update nach Job-Ende
            if self.queue_callback:
                self.queue_callback(self.get_status())
            
            # Wenn Queue leer ist, setze sie zurück
            if self.queue.qsize() == 0:
                self.reset_queue()
    
    def add_job(self, job: Dict[str, Any]) -> str:
        """
        Fügt einen Job zur Queue hinzu
        
        Args:
            job: Job-Dictionary mit allen notwendigen Informationen
            
        Returns:
            Job-ID für Tracking
        """
        job_id = job.get('id', f"job_{int(time.time() * 1000)}")
        job['id'] = job_id
        job['status'] = 'pending'
        job['added_at'] = time.time()
        
        self.queue.put(job)
        self.total_jobs_added += 1  # Erhöhe die Gesamtanzahl
        
        logger.info(f"📋 Job {job_id} zur Queue hinzugefügt. Aktuelle Queue-Länge: {self.queue.qsize()}, Total Jobs: {self.total_jobs_added}")
        
        # Sende pending Status
        if self.status_callback:
            self.status_callback(job, 'pending')
        
        # Sende Queue-Status-Update
        if self.queue_callback:
            self.queue_callback(self.get_status())
        
        return job_id
    
    def set_status_callback(self, callback: Callable):
        """Setzt die Callback-Funktion für Status-Updates"""
        self.status_callback = callback
    
    def set_queue_callback(self, callback: Callable):
        """Setzt die Callback-Funktion für Queue-Status-Updates"""
        self.queue_callback = callback
    
    def get_status(self) -> Dict[str, Any]:
        """Gibt den aktuellen Queue-Status zurück"""
        queue_length = self.queue.qsize()
        is_processing = self.is_processing
        current_job = self.current_job.get('id') if self.current_job else None
        
        # Verwende die Gesamtanzahl der hinzugefügten Jobs
        total_jobs = self.total_jobs_added
        
        return {
            'queue_length': queue_length,
            'is_processing': is_processing,
            'current_job': current_job,
            'finished_jobs': total_jobs - queue_length - (1 if is_processing else 0),
            'total_jobs': total_jobs
        }
    
    def shutdown(self):
        """Beendet die Queue-Verarbeitung"""
        self._stop_event.set()
        self.queue.put(None)  # Shutdown-Signal
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=5)
        logger.info("🛑 Processing Queue heruntergefahren")
    
    def reset_queue(self):
        """Setzt die Queue zurück (für neue Bulk-Verarbeitung)"""
        self.total_jobs_added = 0
        logger.info("🔄 Queue zurückgesetzt für neue Bulk-Verarbeitung")

# Globale Queue-Instanz
processing_queue = ProcessingQueue()

# Setze Status-Callback für WebSocket-Updates
def status_callback(job, status):
    """Callback-Funktion für Status-Updates"""
    try:
        from modules.logger_utils import send_processing_status
        from modules.meta import ProcessingMeta, ProcessingMode
        
        # Erstelle temporäres Meta-Objekt für Status-Update mit allen erforderlichen Parametern
        meta = ProcessingMeta(
            artist=job.get('artist', 'Unknown'),
            title=job.get('title', 'Unknown'),
            mode=ProcessingMode.ULTRASTAR,
            base_dir=job.get('base_dir', ''),
            folder_name=job.get('folder_name', 'Unknown'),
            folder_path=job.get('folder_path', '')
        )
        
        # Sende Status-Update
        send_processing_status(meta, status)
        
    except Exception as e:
        logger.error(f"❌ Fehler beim Senden des Status-Updates: {e}")

# Setze Queue-Callback für Queue-Status-Updates
def queue_callback(queue_status):
    """Callback-Funktion für Queue-Status-Updates"""
    try:
        from modules.logger_utils import send_queue_status
        
        # Sende Queue-Status-Update
        send_queue_status(queue_status)
        
    except Exception as e:
        logger.error(f"❌ Fehler beim Senden des Queue-Status-Updates: {e}")

# Setze die Callbacks
processing_queue.set_status_callback(status_callback)
processing_queue.set_queue_callback(queue_callback)
