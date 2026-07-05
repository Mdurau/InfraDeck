import psutil
import asyncio

class SystemService:
    @staticmethod
    async def get_live_metrics():
        cpu_percent = psutil.cpu_percent(interval=None)
        # logical=True counts hyperthreaded/virtual cores; logical=False counts physical cores
        cpu_cores = psutil.cpu_count(logical=True) 
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu_usage_percent": cpu_percent,
            "cpu_cores": cpu_cores,  
            "memory": {
                "total_gb": round(memory.total / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "percent": memory.percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "percent": disk.percent
            }
        }